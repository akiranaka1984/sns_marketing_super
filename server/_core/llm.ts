import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://api.openai.com/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

async function invokeOpenAI(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = 4096;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

// --- Anthropic (Claude) adapter ---

function convertImageContentToAnthropic(part: ImageContent): Record<string, unknown> {
  const url = part.image_url.url;
  // data:image/png;base64,xxxx → extract media_type and base64 data
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: match[1],
        data: match[2],
      },
    };
  }
  // URL-based image
  return {
    type: "image",
    source: {
      type: "url",
      url,
    },
  };
}

function convertMessagesForAnthropic(messages: Message[]): {
  system: string | undefined;
  messages: Record<string, unknown>[];
} {
  let systemText: string | undefined;
  const anthropicMessages: Record<string, unknown>[] = [];

  for (const msg of messages) {
    // Extract system messages into the system parameter
    if (msg.role === "system") {
      const parts = ensureArray(msg.content);
      const text = parts
        .map((p) => (typeof p === "string" ? p : p.type === "text" ? p.text : ""))
        .filter(Boolean)
        .join("\n");
      systemText = systemText ? `${systemText}\n${text}` : text;
      continue;
    }

    // Convert tool result messages
    if (msg.role === "tool") {
      anthropicMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === "string"
              ? msg.content
              : ensureArray(msg.content)
                  .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
                  .join("\n"),
          },
        ],
      });
      continue;
    }

    // Convert user/assistant messages
    const role = msg.role === "function" ? "user" : msg.role;
    const parts = ensureArray(msg.content);

    const contentBlocks: Record<string, unknown>[] = [];
    for (const part of parts) {
      if (typeof part === "string") {
        contentBlocks.push({ type: "text", text: part });
      } else if (part.type === "text") {
        contentBlocks.push({ type: "text", text: part.text });
      } else if (part.type === "image_url") {
        contentBlocks.push(convertImageContentToAnthropic(part));
      } else if (part.type === "file_url") {
        // File content not directly supported by Anthropic; pass as text reference
        contentBlocks.push({
          type: "text",
          text: `[File: ${part.file_url.url}]`,
        });
      }
    }

    // Collapse single text block to string for simplicity
    if (contentBlocks.length === 1 && contentBlocks[0].type === "text") {
      anthropicMessages.push({ role, content: (contentBlocks[0] as { type: string; text: string }).text });
    } else {
      anthropicMessages.push({ role, content: contentBlocks });
    }
  }

  return { system: systemText, messages: anthropicMessages };
}

function convertToolsForAnthropic(tools: Tool[]): Record<string, unknown>[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description || "",
    input_schema: tool.function.parameters || { type: "object", properties: {} },
  }));
}

function convertToolChoiceForAnthropic(
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): Record<string, unknown> | undefined {
  if (!toolChoice) return undefined;

  if (toolChoice === "none") {
    // Anthropic doesn't have "none" — omit tools instead
    return undefined;
  }
  if (toolChoice === "auto") {
    return { type: "auto" };
  }
  if (toolChoice === "required") {
    return { type: "any" };
  }
  if ("name" in toolChoice) {
    return { type: "tool", name: toolChoice.name };
  }
  if ("function" in toolChoice) {
    return { type: "tool", name: toolChoice.function.name };
  }
  return undefined;
}

function buildJsonSchemaInstruction(params: InvokeParams): string | undefined {
  const normalizedFormat = normalizeResponseFormat({
    responseFormat: params.responseFormat,
    response_format: params.response_format,
    outputSchema: params.outputSchema,
    output_schema: params.output_schema,
  });

  if (!normalizedFormat) return undefined;

  if (normalizedFormat.type === "json_object") {
    return "You MUST respond with valid JSON only. No additional text outside the JSON.";
  }

  if (normalizedFormat.type === "json_schema") {
    return `You MUST respond with valid JSON that conforms to this schema:\n${JSON.stringify(normalizedFormat.json_schema.schema, null, 2)}\nRespond with ONLY the JSON, no additional text.`;
  }

  return undefined;
}

async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const { system, messages: anthropicMessages } = convertMessagesForAnthropic(params.messages);

  // Prepend JSON schema instruction to system prompt if needed
  const jsonInstruction = buildJsonSchemaInstruction(params);
  const finalSystem = [system, jsonInstruction].filter(Boolean).join("\n\n") || undefined;

  const payload: Record<string, unknown> = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: params.maxTokens || params.max_tokens || 4096,
    messages: anthropicMessages,
  };

  if (finalSystem) {
    payload.system = finalSystem;
  }

  const tc = params.toolChoice || params.tool_choice;

  if (params.tools && params.tools.length > 0 && tc !== "none") {
    payload.tools = convertToolsForAnthropic(params.tools);

    const anthropicToolChoice = convertToolChoiceForAnthropic(tc, params.tools);
    if (anthropicToolChoice) {
      payload.tool_choice = anthropicToolChoice;
    }
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const data = await response.json() as {
    id: string;
    model: string;
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
    stop_reason: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };

  // Convert Anthropic response to OpenAI-compatible InvokeResult
  const textParts = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text || "");
  const contentText = textParts.join("");

  const toolCalls: ToolCall[] = data.content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: block.id!,
      type: "function" as const,
      function: {
        name: block.name!,
        arguments: JSON.stringify(block.input),
      },
    }));

  const finishReasonMap: Record<string, string> = {
    end_turn: "stop",
    max_tokens: "length",
    tool_use: "tool_calls",
    stop_sequence: "stop",
  };

  return {
    id: data.id,
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: contentText,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReasonMap[data.stop_reason || "end_turn"] || "stop",
      },
    ],
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
}

// --- Dispatcher ---

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = ENV.llmProvider;
  if (provider === "anthropic") {
    return invokeAnthropic(params);
  }
  return invokeOpenAI(params);
}
