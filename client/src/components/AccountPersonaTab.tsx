import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface AccountPersonaTabProps {
  accountId: number;
  account: {
    personaRole?: string | null;
    personaTone?: string | null;
    personaCharacteristics?: string | null;
  };
}

const PERSONA_ROLES = [
  { value: "specialist", label: "専門家・詳しい人" },
  { value: "casual_user", label: "カジュアルユーザー" },
  { value: "reviewer", label: "レビュアー・評論家" },
  { value: "enthusiast", label: "熱狂的ファン" },
  { value: "influencer", label: "インフルエンサー" },
  { value: "newbie", label: "初心者・入門者" },
  { value: "business", label: "ビジネスパーソン" },
  { value: "custom", label: "カスタム" },
];

const PERSONA_TONES = [
  { value: "formal", label: "フォーマル" },
  { value: "casual", label: "カジュアル" },
  { value: "friendly", label: "フレンドリー" },
  { value: "professional", label: "プロフェッショナル" },
  { value: "humorous", label: "ユーモラス" },
];

export default function AccountPersonaTab({ accountId, account }: AccountPersonaTabProps) {
  const utils = trpc.useUtils();
  const [personaRole, setPersonaRole] = useState(account.personaRole || "");
  const [personaTone, setPersonaTone] = useState(account.personaTone || "");
  const [personaCharacteristics, setPersonaCharacteristics] = useState(account.personaCharacteristics || "");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setPersonaRole(account.personaRole || "");
    setPersonaTone(account.personaTone || "");
    setPersonaCharacteristics(account.personaCharacteristics || "");
    setHasChanges(false);
  }, [account]);

  const updatePersonaMutation = trpc.accounts.updatePersona.useMutation({
    onSuccess: () => {
      toast.success("ペルソナ設定を保存しました");
      setHasChanges(false);
      utils.accounts.byId.invalidate({ id: accountId });
    },
    onError: (error) => {
      toast.error(`保存失敗: ${error.message}`);
    },
  });

  const generateCharacteristicsMutation = trpc.accounts.generatePersonaCharacteristics.useMutation({
    onSuccess: (result) => {
      setPersonaCharacteristics(result.characteristics);
      setHasChanges(true);
      toast.success("AIが叩き台を生成しました。必要に応じて編集してください。");
    },
    onError: (error) => {
      toast.error(`生成失敗: ${error.message}`);
    },
  });

  const handleRoleChange = (value: string) => {
    setPersonaRole(value);
    setHasChanges(true);
  };

  const handleToneChange = (value: string) => {
    setPersonaTone(value);
    setHasChanges(true);
  };

  const handleCharacteristicsChange = (value: string) => {
    setPersonaCharacteristics(value);
    setHasChanges(true);
  };

  const handleGenerateCharacteristics = () => {
    if (!personaRole || !personaTone) {
      toast.error("役割とトーンを先に選択してください");
      return;
    }
    generateCharacteristicsMutation.mutate({
      role: personaRole,
      tone: personaTone as 'formal' | 'casual' | 'friendly' | 'professional' | 'humorous',
    });
  };

  const handleSave = () => {
    updatePersonaMutation.mutate({
      accountId,
      personaRole: personaRole || null,
      personaTone: (personaTone as any) || null,
      personaCharacteristics: personaCharacteristics || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          ペルソナ設定
        </CardTitle>
        <CardDescription>
          このアカウントの個性・キャラクター設定を行います。投稿やコメント生成時に反映されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Role Selection */}
        <div className="space-y-2">
          <Label htmlFor="persona-role">役割・キャラクター</Label>
          <Select value={personaRole} onValueChange={handleRoleChange}>
            <SelectTrigger id="persona-role">
              <SelectValue placeholder="役割を選択" />
            </SelectTrigger>
            <SelectContent>
              {PERSONA_ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            投稿やコメントを生成する際のキャラクター設定
          </p>
        </div>

        {/* Tone Selection */}
        <div className="space-y-2">
          <Label htmlFor="persona-tone">トーン・口調</Label>
          <Select value={personaTone} onValueChange={handleToneChange}>
            <SelectTrigger id="persona-tone">
              <SelectValue placeholder="トーンを選択" />
            </SelectTrigger>
            <SelectContent>
              {PERSONA_TONES.map((tone) => (
                <SelectItem key={tone.value} value={tone.value}>
                  {tone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            文章の雰囲気や口調
          </p>
        </div>

        {/* Characteristics */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="persona-characteristics">特徴・補足説明</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateCharacteristics}
              disabled={!personaRole || !personaTone || generateCharacteristicsMutation.isPending}
              className="text-xs"
            >
              {generateCharacteristicsMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-3 w-3" />
                  AIで叩き台を生成
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="persona-characteristics"
            value={personaCharacteristics}
            onChange={(e) => handleCharacteristicsChange(e.target.value)}
            placeholder="例: IT業界に詳しく、特にAI・機械学習に興味がある。絵文字は控えめに使用。時々皮肉なジョークを言う。"
            className="min-h-[100px]"
          />
          <p className="text-xs text-slate-500">
            AIが投稿やコメントを生成する際に参考にする追加情報
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updatePersonaMutation.isPending}
          >
            {updatePersonaMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
