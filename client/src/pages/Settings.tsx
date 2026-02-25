import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Save, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  // OpenAI state
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Anthropic state
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  // LLM provider state
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");

  // X API state
  const [xBearerToken, setXBearerToken] = useState("");
  const [showXBearerToken, setShowXBearerToken] = useState(false);

  // Get API status
  const { data: apiStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.settings.getApiStatus.useQuery();

  // Get saved API keys from database
  const { data: savedApiKeys, isLoading: keysLoading } = trpc.settings.getApiKeys.useQuery();

  // Get X API settings
  const { data: xApiSettings, isLoading: xApiLoading, refetch: refetchXApi } = trpc.xApiSettings.get.useQuery();

  // Load saved API keys when data is available
  useEffect(() => {
    if (savedApiKeys) {
      if (savedApiKeys.openaiApiKey && !openaiApiKey) {
        setOpenaiApiKey(savedApiKeys.openaiApiKey);
      }
      if (savedApiKeys.anthropicApiKey && !anthropicApiKey) {
        setAnthropicApiKey(savedApiKeys.anthropicApiKey);
      }
      if (savedApiKeys.llmProvider) {
        setLlmProvider(savedApiKeys.llmProvider);
      }
    }
  }, [savedApiKeys]);

  // Load X API settings
  useEffect(() => {
    if (xApiSettings) {
      if (xApiSettings.bearerToken && !xBearerToken) {
        setXBearerToken(xApiSettings.bearerToken);
      }
    }
  }, [xApiSettings]);

  // Save API keys
  const saveApiKeys = trpc.settings.saveApiKeys.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStatus();
    },
    onError: (error) => {
      toast.error("\u30A8\u30E9\u30FC: " + error.message);
    },
  });

  // Save X API settings
  const saveXApiSettings = trpc.xApiSettings.save.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchXApi();
    },
    onError: (error) => {
      toast.error("\u30A8\u30E9\u30FC: " + error.message);
    },
  });

  // Test X API connection
  const testXApiConnection = trpc.xApiSettings.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("\u30A8\u30E9\u30FC: " + error.message);
    },
  });

  const testOpenAI = trpc.settings.testOpenAIConnection.useQuery(
    { apiKey: openaiApiKey || undefined },
    { enabled: false }
  );

  const testAnthropic = trpc.settings.testAnthropicConnection.useQuery(
    { apiKey: anthropicApiKey || undefined },
    { enabled: false }
  );

  const handleSaveOpenAI = () => {
    if (!openaiApiKey) {
      toast.warning("API\u30AD\u30FC\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    saveApiKeys.mutate({ openaiApiKey });
  };

  const handleSaveAnthropic = () => {
    if (!anthropicApiKey) {
      toast.warning("API\u30AD\u30FC\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    saveApiKeys.mutate({ anthropicApiKey });
  };

  const handleProviderChange = (provider: "openai" | "anthropic") => {
    setLlmProvider(provider);
    saveApiKeys.mutate({ llmProvider: provider });
  };

  const handleSaveXApi = () => {
    if (!xBearerToken) {
      toast.warning("Bearer Token\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    saveXApiSettings.mutate({ bearerToken: xBearerToken });
  };

  const handleTestOpenAI = () => {
    testOpenAI.refetch();
  };

  const handleTestAnthropic = () => {
    testAnthropic.refetch();
  };

  const handleTestXApi = () => {
    if (!xBearerToken) {
      toast.warning("Bearer Token\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    testXApiConnection.mutate({ bearerToken: xBearerToken });
  };

  if (statusLoading || keysLoading || xApiLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#1A1A1A]" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Page Title - Neobrutalism */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[4px_4px_0_#1A1A1A]">
            <span className="text-[28px]">{"\u2699\uFE0F"}</span>
          </div>
          <div>
            <h1 className="text-[26px] font-bold text-[#1A1A1A] tracking-tight">API{"\u8A2D\u5B9A"}</h1>
            <p className="text-[13px] text-[#6B6B6B] font-bold">
              API{"\u30AD\u30FC\u306E\u8A2D\u5B9A\u3068\u63A5\u7D9A\u30C6\u30B9\u30C8"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* LLM Provider Selection */}
        <div className="bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          <div className="bg-[#FFD700] px-5 py-4 border-b-2 border-[#1A1A1A]">
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">LLM{"\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC\u9078\u629E"}</h3>
            <p className="text-[12px] text-[#6B6B6B] font-bold mt-1">AI{"\u6A5F\u80FD\u3067\u4F7F\u7528\u3059\u308B\u30E2\u30C7\u30EB\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"}</p>
          </div>
          <div className="p-5">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleProviderChange("openai")}
                className={`flex-1 p-4 rounded-lg border-2 border-[#1A1A1A] transition-all text-left font-bold shadow-[4px_4px_0_#1A1A1A] ${
                  llmProvider === "openai"
                    ? "bg-[#4ECDC4] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
                    : "bg-[#FFFDF7] hover:bg-[#FFF8DC] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-lg border-2 border-[#1A1A1A] flex items-center justify-center ${
                    llmProvider === "openai" ? "bg-[#1A1A1A]" : "bg-[#FFFDF7]"
                  }`}>
                    {llmProvider === "openai" && (
                      <div className="w-2 h-2 rounded-lg bg-[#FFFDF7]" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#1A1A1A]">OpenAI</p>
                    <p className="text-[11px] text-[#6B6B6B] font-bold">GPT-4o-mini</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange("anthropic")}
                className={`flex-1 p-4 rounded-lg border-2 border-[#1A1A1A] transition-all text-left font-bold shadow-[4px_4px_0_#1A1A1A] ${
                  llmProvider === "anthropic"
                    ? "bg-[#4ECDC4] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
                    : "bg-[#FFFDF7] hover:bg-[#FFF8DC] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-lg border-2 border-[#1A1A1A] flex items-center justify-center ${
                    llmProvider === "anthropic" ? "bg-[#1A1A1A]" : "bg-[#FFFDF7]"
                  }`}>
                    {llmProvider === "anthropic" && (
                      <div className="w-2 h-2 rounded-lg bg-[#FFFDF7]" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#1A1A1A]">Anthropic</p>
                    <p className="text-[11px] text-[#6B6B6B] font-bold">Claude Sonnet 4.5</p>
                  </div>
                </div>
              </button>
            </div>
            {saveApiKeys.isPending && (
              <div className="mt-3 flex items-center gap-2 text-[12px] text-[#6B6B6B] font-bold">
                <Loader2 className="h-3 w-3 animate-spin" />
                {"\u4FDD\u5B58\u4E2D..."}
              </div>
            )}
          </div>
        </div>

        {/* OpenAI API Settings */}
        <div className="bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          <div className="bg-[#A8E6CF] px-5 py-4 border-b-2 border-[#1A1A1A]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#1A1A1A]">OpenAI API</h3>
              <div className="flex items-center gap-2">
                {llmProvider === "openai" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                    {"\u4F7F\u7528\u4E2D"}
                  </span>
                )}
                {apiStatus?.openai.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                    <span className="w-[5px] h-[5px] rounded-lg bg-[#1A1A1A]" />
                    {"\u8A2D\u5B9A\u6E08\u307F"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                    <span className="w-[5px] h-[5px] rounded-lg bg-[#1A1A1A]" />
                    {"\u672A\u8A2D\u5B9A"}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[12px] text-[#6B6B6B] font-bold mt-1">AI{"\u6295\u7A3F\u5185\u5BB9\u751F\u6210\u3068\u6226\u7565\u4F5C\u6210\u306B\u4F7F\u7528"}</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-[13px] font-bold text-[#1A1A1A]">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="openai-key"
                    type={showOpenaiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="pr-10 border-2 border-[#1A1A1A] text-[13px] rounded-lg font-bold bg-[#FFFDF7] focus:ring-2 focus:ring-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                  >
                    {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {!apiStatus?.openai.configured && (
              <div className="p-4 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] text-[12px] text-[#1A1A1A] font-bold shadow-[2px_2px_0_#1A1A1A]">
                OpenAI API{"\u30AD\u30FC\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-[#1A1A1A] hover:underline font-bold"
                >
                  API{"\u30AD\u30FC\u3092\u53D6\u5F97"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleTestOpenAI}
                disabled={!openaiApiKey || testOpenAI.isFetching}
                variant="outline"
                size="sm"
                className="text-[13px] font-bold border-2 border-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] rounded-lg transition-all shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                {testOpenAI.isFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {"\u63A5\u7D9A\u30C6\u30B9\u30C8"}
              </Button>
              <Button
                onClick={handleSaveOpenAI}
                disabled={!openaiApiKey || saveApiKeys.isPending}
                size="sm"
                className="text-[13px] font-bold bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {saveApiKeys.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <Save className="mr-2 h-3.5 w-3.5" />
                {"\u4FDD\u5B58"}
              </Button>
            </div>

            {testOpenAI.data && (
              <div className={`p-4 rounded-lg text-[12px] flex items-center gap-2 font-bold border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] ${
                testOpenAI.data.success ? 'bg-[#A8E6CF] text-[#1A1A1A]' : 'bg-[#FF6B6B] text-[#1A1A1A]'
              }`}>
                {testOpenAI.data.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testOpenAI.data.message}
              </div>
            )}
          </div>
        </div>

        {/* Anthropic API Settings */}
        <div className="bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          <div className="bg-[#DDA0DD] px-5 py-4 border-b-2 border-[#1A1A1A]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#1A1A1A]">Anthropic API</h3>
              <div className="flex items-center gap-2">
                {llmProvider === "anthropic" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                    {"\u4F7F\u7528\u4E2D"}
                  </span>
                )}
                {apiStatus?.anthropic?.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                    <span className="w-[5px] h-[5px] rounded-lg bg-[#1A1A1A]" />
                    {"\u8A2D\u5B9A\u6E08\u307F"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                    <span className="w-[5px] h-[5px] rounded-lg bg-[#1A1A1A]" />
                    {"\u672A\u8A2D\u5B9A"}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[12px] text-[#6B6B6B] font-bold mt-1">Claude Sonnet 4.5{"\u3092\u4F7F\u7528\u3057\u305FAI\u6A5F\u80FD"}</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anthropic-key" className="text-[13px] font-bold text-[#1A1A1A]">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="anthropic-key"
                    type={showAnthropicKey ? "text" : "password"}
                    placeholder="sk-ant-..."
                    value={anthropicApiKey}
                    onChange={(e) => setAnthropicApiKey(e.target.value)}
                    className="pr-10 border-2 border-[#1A1A1A] text-[13px] rounded-lg font-bold bg-[#FFFDF7] focus:ring-2 focus:ring-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                  >
                    {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {!apiStatus?.anthropic?.configured && (
              <div className="p-4 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] text-[12px] text-[#1A1A1A] font-bold shadow-[2px_2px_0_#1A1A1A]">
                Anthropic API{"\u30AD\u30FC\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-[#1A1A1A] hover:underline font-bold"
                >
                  API{"\u30AD\u30FC\u3092\u53D6\u5F97"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleTestAnthropic}
                disabled={!anthropicApiKey || testAnthropic.isFetching}
                variant="outline"
                size="sm"
                className="text-[13px] font-bold border-2 border-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] rounded-lg transition-all shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                {testAnthropic.isFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {"\u63A5\u7D9A\u30C6\u30B9\u30C8"}
              </Button>
              <Button
                onClick={handleSaveAnthropic}
                disabled={!anthropicApiKey || saveApiKeys.isPending}
                size="sm"
                className="text-[13px] font-bold bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {saveApiKeys.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <Save className="mr-2 h-3.5 w-3.5" />
                {"\u4FDD\u5B58"}
              </Button>
            </div>

            {testAnthropic.data && (
              <div className={`p-4 rounded-lg text-[12px] flex items-center gap-2 font-bold border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] ${
                testAnthropic.data.success ? 'bg-[#A8E6CF] text-[#1A1A1A]' : 'bg-[#FF6B6B] text-[#1A1A1A]'
              }`}>
                {testAnthropic.data.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testAnthropic.data.message}
              </div>
            )}
          </div>
        </div>

        {/* X API Settings */}
        <div className="bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          <div className="bg-[#87CEEB] px-5 py-4 border-b-2 border-[#1A1A1A]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#1A1A1A]">X (Twitter) API</h3>
              {xApiSettings?.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                  <span className="w-[5px] h-[5px] rounded-lg bg-[#1A1A1A]" />
                  {"\u8A2D\u5B9A\u6E08\u307F"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                  <span className="w-[5px] h-[5px] rounded-lg bg-[#1A1A1A]" />
                  {"\u672A\u8A2D\u5B9A"}
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#6B6B6B] font-bold mt-1">{"\u30C4\u30A4\u30FC\u30C8\u53D6\u5F97\u3001\u30E6\u30FC\u30B6\u30FC\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u53D6\u5F97\u306B\u4F7F\u7528"}</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="x-bearer-token" className="text-[13px] font-bold text-[#1A1A1A]">Bearer Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="x-bearer-token"
                    type={showXBearerToken ? "text" : "password"}
                    placeholder="AAAA..."
                    value={xBearerToken}
                    onChange={(e) => setXBearerToken(e.target.value)}
                    className="pr-10 border-2 border-[#1A1A1A] text-[13px] rounded-lg font-bold bg-[#FFFDF7] focus:ring-2 focus:ring-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowXBearerToken(!showXBearerToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                  >
                    {showXBearerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#6B6B6B] font-bold">
                X Developer Portal{"\u3067\u53D6\u5F97\u3067\u304D\u308BBearer Token\uFF08App-only\u8A8D\u8A3C\u7528\uFF09"}
              </p>
            </div>

            {!xApiSettings?.configured && (
              <div className="p-4 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] text-[12px] text-[#1A1A1A] font-bold shadow-[2px_2px_0_#1A1A1A]">
                X API Bearer Token{"\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}
                <a
                  href="https://developer.twitter.com/en/portal/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-[#1A1A1A] hover:underline font-bold"
                >
                  Developer Portal{"\u3078"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleTestXApi}
                disabled={!xBearerToken || testXApiConnection.isPending}
                variant="outline"
                size="sm"
                className="text-[13px] font-bold border-2 border-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] rounded-lg transition-all shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                {testXApiConnection.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {"\u63A5\u7D9A\u30C6\u30B9\u30C8"}
              </Button>
              <Button
                onClick={handleSaveXApi}
                disabled={!xBearerToken || saveXApiSettings.isPending}
                size="sm"
                className="text-[13px] font-bold bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {saveXApiSettings.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <Save className="mr-2 h-3.5 w-3.5" />
                {"\u4FDD\u5B58"}
              </Button>
            </div>

            {xApiSettings?.lastTestedAt && (
              <p className="text-[11px] text-[#6B6B6B] font-bold">
                {"\u6700\u7D42\u30C6\u30B9\u30C8: "}{new Date(xApiSettings.lastTestedAt).toLocaleString('ja-JP')}
                {xApiSettings.testResult && ` (${xApiSettings.testResult})`}
              </p>
            )}
          </div>
        </div>

        {/* API Setup Guide */}
        <div className="bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          <div className="bg-[#FFDAB9] px-5 py-4 border-b-2 border-[#1A1A1A]">
            <h3 className="text-[14px] font-bold text-[#1A1A1A]">API{"\u8A2D\u5B9A\u65B9\u6CD5"}</h3>
          </div>
          <div className="p-5 space-y-5 text-[13px]">
            <div>
              <h4 className="font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-[#A8E6CF] border-2 border-[#1A1A1A] flex items-center justify-center text-[10px] font-bold text-[#1A1A1A]">1</span>
                OpenAI API
              </h4>
              <ol className="list-decimal list-inside text-[#6B6B6B] font-bold space-y-1.5 ml-7">
                <li><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#1A1A1A] hover:underline font-bold">OpenAI Platform</a>{"\u3067API\u30AD\u30FC\u3092\u4F5C\u6210"}</li>
                <li>{"\u4E0A\u306E\u30D5\u30A9\u30FC\u30E0\u306B\u5165\u529B\u3057\u3066\u300C\u63A5\u7D9A\u30C6\u30B9\u30C8\u300D\u3067\u78BA\u8A8D"}</li>
                <li>{"\u300C\u4FDD\u5B58\u300D\u30DC\u30BF\u30F3\u3067\u8A2D\u5B9A\u3092\u4FDD\u5B58"}</li>
              </ol>
            </div>
            <div className="border-t-2 border-[#1A1A1A] pt-5">
              <h4 className="font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-[#DDA0DD] border-2 border-[#1A1A1A] flex items-center justify-center text-[10px] font-bold text-[#1A1A1A]">2</span>
                Anthropic API
              </h4>
              <ol className="list-decimal list-inside text-[#6B6B6B] font-bold space-y-1.5 ml-7">
                <li><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[#1A1A1A] hover:underline font-bold">Anthropic Console</a>{"\u3067API\u30AD\u30FC\u3092\u4F5C\u6210"}</li>
                <li>{"\u4E0A\u306E\u30D5\u30A9\u30FC\u30E0\u306B\u5165\u529B\u3057\u3066\u300C\u63A5\u7D9A\u30C6\u30B9\u30C8\u300D\u3067\u78BA\u8A8D"}</li>
                <li>{"\u300C\u4FDD\u5B58\u300D\u30DC\u30BF\u30F3\u3067\u8A2D\u5B9A\u3092\u4FDD\u5B58"}</li>
              </ol>
            </div>
            <div className="border-t-2 border-[#1A1A1A] pt-5">
              <h4 className="font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-[#87CEEB] border-2 border-[#1A1A1A] flex items-center justify-center text-[10px] font-bold text-[#1A1A1A]">3</span>
                X (Twitter) API
              </h4>
              <ol className="list-decimal list-inside text-[#6B6B6B] font-bold space-y-1.5 ml-7">
                <li><a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#1A1A1A] hover:underline font-bold">X Developer Portal</a>{"\u3067\u30A2\u30D7\u30EA\u3092\u4F5C\u6210"}</li>
                <li>{"\u300CKeys and tokens\u300D\u304B\u3089Bearer Token\u3092\u53D6\u5F97"}</li>
                <li>{"\u4E0A\u306E\u30D5\u30A9\u30FC\u30E0\u306B\u5165\u529B\u3057\u3066\u300C\u63A5\u7D9A\u30C6\u30B9\u30C8\u300D\u3067\u78BA\u8A8D"}</li>
                <li>{"\u300C\u4FDD\u5B58\u300D\u30DC\u30BF\u30F3\u3067\u8A2D\u5B9A\u3092\u4FDD\u5B58"}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
