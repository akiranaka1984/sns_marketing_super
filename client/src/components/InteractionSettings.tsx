import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Users, Percent, UserPlus } from "lucide-react";

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
  const [retweetEnabled, setRetweetEnabled] = useState(false);
  const [retweetDelayMin, setRetweetDelayMin] = useState(15);
  const [retweetDelayMax, setRetweetDelayMax] = useState(90);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [followDelayMin, setFollowDelayMin] = useState(30);
  const [followDelayMax, setFollowDelayMax] = useState(180);
  const [followTargetUsers, setFollowTargetUsers] = useState("");
  const [defaultPersona, setDefaultPersona] = useState("フレンドリーなユーザー");
  const [reactionProbability, setReactionProbability] = useState(100);
  const [maxReactingAccounts, setMaxReactingAccounts] = useState(0);

  const { data: settings, refetch } = trpc.interactionSettings.get.useQuery({ projectId });
  const saveMutation = trpc.interactionSettings.save.useMutation();
  const loadFromStrategyMutation = trpc.interactionSettings.loadFromStrategy.useMutation();

  useEffect(() => {
    if (settings) {
      setIsEnabled(Boolean(settings.isEnabled));
      setLikeEnabled(Boolean(settings.likeEnabled ?? 1));
      setLikeDelayMin(settings.likeDelayMinMin ?? 5);
      setLikeDelayMax(settings.likeDelayMinMax ?? 30);
      setCommentEnabled(Boolean(settings.commentEnabled ?? 1));
      setCommentDelayMin(settings.commentDelayMinMin ?? 10);
      setCommentDelayMax(settings.commentDelayMinMax ?? 60);
      setRetweetEnabled(Boolean(settings.retweetEnabled));
      setRetweetDelayMin(settings.retweetDelayMinMin ?? 15);
      setRetweetDelayMax(settings.retweetDelayMinMax ?? 90);
      setFollowEnabled(Boolean(settings.followEnabled));
      setFollowDelayMin(settings.followDelayMinMin ?? 30);
      setFollowDelayMax(settings.followDelayMinMax ?? 180);
      // Parse followTargetUsers JSON array to newline-separated string
      if (settings.followTargetUsers) {
        try {
          const users = JSON.parse(settings.followTargetUsers);
          setFollowTargetUsers(Array.isArray(users) ? users.join("\n") : "");
        } catch {
          setFollowTargetUsers("");
        }
      } else {
        setFollowTargetUsers("");
      }
      setDefaultPersona(settings.defaultPersona || "フレンドリーなユーザー");
      setReactionProbability(settings.reactionProbability ?? 100);
      setMaxReactingAccounts(settings.maxReactingAccounts ?? 0);
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
        retweetEnabled,
        retweetDelayMinMin: retweetDelayMin,
        retweetDelayMinMax: retweetDelayMax,
        followEnabled,
        followDelayMinMin: followDelayMin,
        followDelayMinMax: followDelayMax,
        followTargetUsers: followTargetUsers.trim()
          ? JSON.stringify(followTargetUsers.split("\n").map(u => u.trim()).filter(Boolean))
          : null,
        defaultPersona,
        reactionProbability,
        maxReactingAccounts,
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

            {/* リツイート設定 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">リツイート（リポスト）</p>
                <Switch checked={retweetEnabled} onCheckedChange={setRetweetEnabled} />
              </div>
              {retweetEnabled && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-gray-500">投稿後</span>
                  <Input
                    type="number"
                    value={retweetDelayMin}
                    onChange={(e) => setRetweetDelayMin(Number(e.target.value))}
                    className="w-20"
                    min={1}
                    max={180}
                  />
                  <span className="text-sm text-gray-500">〜</span>
                  <Input
                    type="number"
                    value={retweetDelayMax}
                    onChange={(e) => setRetweetDelayMax(Number(e.target.value))}
                    className="w-20"
                    min={1}
                    max={180}
                  />
                  <span className="text-sm text-gray-500">分後にランダム実行</span>
                </div>
              )}
            </div>

            {/* フォロー設定 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  フォロー
                </p>
                <Switch checked={followEnabled} onCheckedChange={setFollowEnabled} />
              </div>
              {followEnabled && (
                <>
                  <div className="flex items-center gap-2 ml-4 mb-3">
                    <span className="text-sm text-gray-500">投稿後</span>
                    <Input
                      type="number"
                      value={followDelayMin}
                      onChange={(e) => setFollowDelayMin(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={360}
                    />
                    <span className="text-sm text-gray-500">〜</span>
                    <Input
                      type="number"
                      value={followDelayMax}
                      onChange={(e) => setFollowDelayMax(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={360}
                    />
                    <span className="text-sm text-gray-500">分後にランダム実行</span>
                  </div>
                  <div className="ml-4">
                    <label className="text-sm text-gray-500 block mb-1">
                      外部フォロー対象ユーザー（1行に1ユーザー）
                    </label>
                    <Textarea
                      value={followTargetUsers}
                      onChange={(e) => setFollowTargetUsers(e.target.value)}
                      placeholder="@username1&#10;@username2&#10;@username3"
                      rows={3}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      投稿者への相互フォローに加え、ここに入力したユーザーもフォロー対象になります
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 選択的反応設定 */}
            <div className="border-t pt-4">
              <p className="font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                選択的反応（自然な動作のため）
              </p>
              <div className="space-y-4 ml-4">
                {/* 反応確率 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-600 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      反応確率
                    </label>
                    <span className="text-sm font-medium text-slate-900">{reactionProbability}%</span>
                  </div>
                  <Slider
                    value={[reactionProbability]}
                    onValueChange={(values) => setReactionProbability(values[0])}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    各アカウントがこの確率で反応します
                  </p>
                </div>

                {/* 最大反応アカウント数 */}
                <div>
                  <label className="text-sm text-slate-600 block mb-2">
                    最大反応アカウント数
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={maxReactingAccounts}
                      onChange={(e) => setMaxReactingAccounts(Number(e.target.value))}
                      className="w-20"
                      min={0}
                      max={100}
                    />
                    <span className="text-sm text-slate-500">
                      {maxReactingAccounts === 0 ? "（無制限）" : "アカウント"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    0 = 全アカウントが反応可能
                  </p>
                </div>
              </div>
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
