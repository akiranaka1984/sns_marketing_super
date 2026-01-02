import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface InteractionSettingsProps {
  projectId: number;
}

export default function InteractionSettings({ projectId }: InteractionSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [likeEnabled, setLikeEnabled] = useState(true);
  const [likeDelayMin, setLikeDelayMin] = useState(5);
  const [likeDelayMax, setLikeDelayMax] = useState(30);
  const [commentEnabled, setCommentEnabled] = useState(true);
  const [commentDelayMin, setCommentDelayMin] = useState(10);
  const [commentDelayMax, setCommentDelayMax] = useState(60);
  const [defaultPersona, setDefaultPersona] = useState("フレンドリーなユーザー");

  const { data: settings, refetch } = trpc.interactionSettings.get.useQuery({ projectId });
  const saveMutation = trpc.interactionSettings.save.useMutation();
  const loadFromStrategyMutation = trpc.interactionSettings.loadFromStrategy.useMutation();

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled ?? false);
      setLikeEnabled(settings.likeEnabled ?? true);
      setLikeDelayMin(settings.likeDelayMinMin ?? 5);
      setLikeDelayMax(settings.likeDelayMinMax ?? 30);
      setCommentEnabled(settings.commentEnabled ?? true);
      setCommentDelayMin(settings.commentDelayMinMin ?? 10);
      setCommentDelayMax(settings.commentDelayMinMax ?? 60);
      setDefaultPersona(settings.defaultPersona || "フレンドリーなユーザー");
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        projectId,
        isEnabled,
        likeEnabled,
        likeDelayMinMin: likeDelayMin,
        likeDelayMinMax: likeDelayMax,
        commentEnabled,
        commentDelayMinMin: commentDelayMin,
        commentDelayMinMax: commentDelayMax,
        defaultPersona,
      });
      toast.success("設定を保存しました");
      refetch();
    } catch (error) {
      toast.error("保存に失敗しました");
    }
  };

  const handleLoadFromStrategy = async () => {
    try {
      const result = await loadFromStrategyMutation.mutateAsync({ projectId });
      if (result.success) {
        toast.success("AI戦略から設定を読み込みました");
        refetch();
      } else {
        toast.error(result.error || "読み込みに失敗しました");
      }
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">相互連携設定</CardTitle>
            <CardDescription>
              投稿後に他のアカウントから自動的にいいね・コメントを行う設定
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadFromStrategy}
            disabled={loadFromStrategyMutation.isPending}
          >
            {loadFromStrategyMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            AI戦略から読み込む
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 有効/無効 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">相互連携を有効にする</p>
            <p className="text-sm text-gray-500">
              投稿後に自動的にいいね・コメントタスクを作成します
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        {isEnabled && (
          <>
            {/* いいね設定 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">いいね</p>
                <Switch checked={likeEnabled} onCheckedChange={setLikeEnabled} />
              </div>
              {likeEnabled && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-gray-500">投稿後</span>
                  <Input
                    type="number"
                    value={likeDelayMin}
                    onChange={(e) => setLikeDelayMin(Number(e.target.value))}
                    className="w-20"
                    min={1}
                    max={120}
                  />
                  <span className="text-sm text-gray-500">〜</span>
                  <Input
                    type="number"
                    value={likeDelayMax}
                    onChange={(e) => setLikeDelayMax(Number(e.target.value))}
                    className="w-20"
                    min={1}
                    max={120}
                  />
                  <span className="text-sm text-gray-500">分後にランダム実行</span>
                </div>
              )}
            </div>

            {/* コメント設定 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">コメント</p>
                <Switch checked={commentEnabled} onCheckedChange={setCommentEnabled} />
              </div>
              {commentEnabled && (
                <>
                  <div className="flex items-center gap-2 ml-4 mb-3">
                    <span className="text-sm text-gray-500">投稿後</span>
                    <Input
                      type="number"
                      value={commentDelayMin}
                      onChange={(e) => setCommentDelayMin(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={120}
                    />
                    <span className="text-sm text-gray-500">〜</span>
                    <Input
                      type="number"
                      value={commentDelayMax}
                      onChange={(e) => setCommentDelayMax(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={120}
                    />
                    <span className="text-sm text-gray-500">分後にランダム実行</span>
                  </div>
                  <div className="ml-4">
                    <label className="text-sm text-gray-500 block mb-1">
                      デフォルトペルソナ（AIコメント生成用）
                    </label>
                    <Input
                      value={defaultPersona}
                      onChange={(e) => setDefaultPersona(e.target.value)}
                      placeholder="例: 金融に詳しい投資家"
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="border-t pt-4">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            設定を保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
