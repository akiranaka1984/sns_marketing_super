import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { User, Sparkles, Save, ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AccountPersonaSettingsProps {
  projectId: number;
}

// Preset persona configurations based on design document
const PRESET_PERSONAS = {
  expert: {
    role: "詳しい人",
    tone: "professional",
    characteristics: "業界知識が豊富で、専門的な視点からコメントします。「これ良いですね！特に○○の部分が参考になります」「○○の観点から見ると興味深いですね」などのコメントスタイル。",
  },
  casual: {
    role: "カジュアルユーザー",
    tone: "casual",
    characteristics: "気軽にSNSを楽しむユーザー。「いいね！👍」「面白い！」「これすごい！」などのシンプルで親しみやすいコメント。",
  },
  professional: {
    role: "専門家",
    tone: "formal",
    characteristics: "ビジネス視点でコメントする専門家。冷静で分析的な意見を述べつつ、建設的なフィードバックを提供。敬語を使用。",
  },
  beginner: {
    role: "初心者",
    tone: "friendly",
    characteristics: "学びながらコンテンツを楽しむ姿勢。「勉強になります！」「なるほど〜」「初めて知りました！」などの素直な反応。",
  },
  fan: {
    role: "熱心なファン",
    tone: "humorous",
    characteristics: "熱心な応援者として反応。「最高です！」「待ってました！」「さすがです！」などの熱いコメント。絵文字を多用。",
  },
  custom: {
    role: "",
    tone: "friendly",
    characteristics: "",
  },
};

const TONE_OPTIONS = [
  { value: "formal", label: "フォーマル" },
  { value: "casual", label: "カジュアル" },
  { value: "friendly", label: "フレンドリー" },
  { value: "professional", label: "プロフェッショナル" },
  { value: "humorous", label: "ユーモラス" },
];

type PresetKey = keyof typeof PRESET_PERSONAS;

interface AccountPersona {
  id: number;
  accountId: number;
  personaRole: string | null;
  personaTone: string | null;
  personaCharacteristics: string | null;
  account: {
    id: number;
    username: string;
    platform: string;
  } | null;
}

export default function AccountPersonaSettings({ projectId }: AccountPersonaSettingsProps) {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [editingPersonas, setEditingPersonas] = useState<Record<number, {
    role: string;
    tone: string;
    characteristics: string;
    preset: PresetKey | null;
  }>>({});

  const { data: projectAccounts, refetch } = trpc.projects.byId.useQuery(
    { id: projectId },
    { select: (data) => data?.accounts || [] }
  );

  const updatePersonaMutation = trpc.projects.updateAccountPersona.useMutation({
    onSuccess: () => {
      toast.success("ペルソナ設定を保存しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`保存に失敗しました: ${error.message}`);
    },
  });

  const toggleExpanded = (accountId: number) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const initializeEditing = (pa: AccountPersona) => {
    if (!editingPersonas[pa.id]) {
      // Detect preset based on current values
      let detectedPreset: PresetKey | null = null;
      for (const [key, preset] of Object.entries(PRESET_PERSONAS)) {
        if (preset.role === pa.personaRole && preset.tone === pa.personaTone) {
          detectedPreset = key as PresetKey;
          break;
        }
      }

      setEditingPersonas(prev => ({
        ...prev,
        [pa.id]: {
          role: pa.personaRole || "",
          tone: pa.personaTone || "friendly",
          characteristics: pa.personaCharacteristics || "",
          preset: detectedPreset,
        },
      }));
    }
  };

  const handlePresetChange = (accountId: number, presetKey: PresetKey) => {
    const preset = PRESET_PERSONAS[presetKey];
    setEditingPersonas(prev => ({
      ...prev,
      [accountId]: {
        role: preset.role,
        tone: preset.tone,
        characteristics: preset.characteristics,
        preset: presetKey,
      },
    }));
  };

  const handleFieldChange = (
    accountId: number,
    field: 'role' | 'tone' | 'characteristics',
    value: string
  ) => {
    setEditingPersonas(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: value,
        preset: field === 'role' || field === 'characteristics' ? 'custom' : prev[accountId]?.preset,
      },
    }));
  };

  const handleSave = async (projectAccountId: number) => {
    const editing = editingPersonas[projectAccountId];
    if (!editing) return;

    await updatePersonaMutation.mutateAsync({
      projectAccountId,
      personaRole: editing.role || undefined,
      personaTone: editing.tone || undefined,
      personaCharacteristics: editing.characteristics || undefined,
    });
  };

  const getPresetBadge = (pa: AccountPersona) => {
    for (const [key, preset] of Object.entries(PRESET_PERSONAS)) {
      if (preset.role === pa.personaRole && preset.tone === pa.personaTone && key !== 'custom') {
        return (
          <Badge variant="secondary" className="text-xs">
            {preset.role}
          </Badge>
        );
      }
    }
    if (pa.personaRole) {
      return (
        <Badge variant="outline" className="text-xs">
          カスタム
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs text-slate-400">
        未設定
      </Badge>
    );
  };

  if (!projectAccounts || projectAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            アカウント別ペルソナ設定
          </CardTitle>
          <CardDescription>
            各アカウントのキャラクター・反応スタイルを設定
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-4">
            プロジェクトにアカウントを追加してください
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5" />
          アカウント別ペルソナ設定
        </CardTitle>
        <CardDescription>
          各アカウントのキャラクター・反応スタイルを設定します。AIコメント生成時にこの設定が使用されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {projectAccounts.map((pa) => {
          const isExpanded = expandedAccounts.has(pa.id);
          const editing = editingPersonas[pa.id];

          return (
            <Collapsible
              key={pa.id}
              open={isExpanded}
              onOpenChange={() => {
                toggleExpanded(pa.id);
                if (!isExpanded) {
                  initializeEditing(pa as AccountPersona);
                }
              }}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">@{pa.account?.username}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">{pa.account?.platform}</span>
                          {getPresetBadge(pa as AccountPersona)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pa.personaRole && (
                        <span className="text-sm text-slate-600 hidden sm:block">
                          {pa.personaRole}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-2 border-t bg-slate-50/50 space-y-4">
                    {/* Preset Selection */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        プリセットペルソナ
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(PRESET_PERSONAS)
                          .filter(([key]) => key !== 'custom')
                          .map(([key, preset]) => (
                            <Button
                              key={key}
                              variant={editing?.preset === key ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePresetChange(pa.id, key as PresetKey)}
                              className="text-xs"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {preset.role}
                            </Button>
                          ))}
                      </div>
                    </div>

                    {/* Custom Role */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                        役割（カスタム）
                      </label>
                      <Input
                        value={editing?.role || ""}
                        onChange={(e) => handleFieldChange(pa.id, 'role', e.target.value)}
                        placeholder="例: 投資に詳しいサラリーマン"
                        className="bg-white"
                      />
                    </div>

                    {/* Tone Selection */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                        トーン
                      </label>
                      <Select
                        value={editing?.tone || "friendly"}
                        onValueChange={(value) => handleFieldChange(pa.id, 'tone', value)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TONE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Characteristics */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                        キャラクター特徴・コメントスタイル
                      </label>
                      <Textarea
                        value={editing?.characteristics || ""}
                        onChange={(e) => handleFieldChange(pa.id, 'characteristics', e.target.value)}
                        placeholder="例: 「勉強になります！」「なるほど〜」などの素直な反応。絵文字を時々使用。"
                        rows={3}
                        className="bg-white resize-none"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleSave(pa.id)}
                        disabled={updatePersonaMutation.isPending}
                        size="sm"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        保存
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
