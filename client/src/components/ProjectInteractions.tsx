import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Heart, MessageCircle, RefreshCw, Plus, Loader2, Repeat2, UserPlus } from "lucide-react";
import InteractionSettings from "./InteractionSettings";
import SchedulerDashboard from "./SchedulerDashboard";
// AccountPersonaSettings removed - now managed at account detail page
import AccountRelationships from "./AccountRelationships";

interface ProjectInteractionsProps {
  projectId: number;
}

export default function ProjectInteractions({ projectId }: ProjectInteractionsProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [newPostUrl, setNewPostUrl] = useState("");
  const [newUsername, setNewUsername] = useState("");

  // データ取得
  const { data: postUrls, refetch: refetchPostUrls } = trpc.interactions.getPostUrls.useQuery({ projectId });
  const { data: accounts } = trpc.interactions.getProjectAccounts.useQuery({ projectId });

  // ミューテーション
  const addPostUrlMutation = trpc.interactions.addPostUrl.useMutation();
  const fetchLatestMutation = trpc.interactions.fetchLatestPosts.useMutation();
  const likeMutation = trpc.interactions.executeLike.useMutation();
  const commentMutation = trpc.interactions.executeComment.useMutation();
  const retweetMutation = trpc.interactions.executeRetweet.useMutation();
  const followMutation = trpc.interactions.executeFollow.useMutation();

  const selectedAccount = accounts?.find(a => a.id.toString() === selectedAccountId);

  // 最新投稿を取得
  const handleFetchLatest = async () => {
    if (!selectedAccount) {
      toast.error("アカウントを選択してください");
      return;
    }

    try {
      const result = await fetchLatestMutation.mutateAsync({
        projectId,
        accountId: selectedAccount.id,
        deviceId: selectedAccount.deviceId!,
        username: selectedAccount.username,
        count: 5,
      });
      
      if (!result.success) {
        toast.error(`取得失敗: ${result.error || "不明なエラー"}`);
        return;
      }
      
      if (result.added > 0) {
        toast.success(`${result.added}件の新しい投稿を追加しました`);
      } else if (result.total > 0) {
        toast.info(`新しい投稿はありません。検索した投稿: ${result.total}件`);
      } else {
        toast.info("投稿が見つかりません");
      }
      refetchPostUrls();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
      toast.error(`取得に失敗しました: ${errorMessage}`);
    }
  };

  // 手動でURL追加
  const handleAddPostUrl = async () => {
    if (!selectedAccount || !newPostUrl) {
      toast.error("アカウントとURLを入力してください");
      return;
    }

    try {
      await addPostUrlMutation.mutateAsync({
        projectId,
        accountId: selectedAccount.id,
        deviceId: selectedAccount.deviceId!,
        username: newUsername || selectedAccount.username,
        postUrl: newPostUrl,
      });
      toast.success("投稿URLを追加しました");
      setNewPostUrl("");
      setNewUsername("");
      refetchPostUrls();
    } catch (error) {
      toast.error("追加に失敗しました");
    }
  };

  // いいね実行
  const handleLike = async (postUrlId: number) => {
    if (!selectedAccount) {
      toast.error("実行するアカウントを選択してください");
      return;
    }

    try {
      const result = await likeMutation.mutateAsync({
        postUrlId,
        fromAccountId: selectedAccount.id,
        fromDeviceId: selectedAccount.deviceId!,
      });
      if (result.success) {
        toast.success("いいねしました");
      } else {
        toast.error(`いいね失敗: ${result.error}`);
      }
    } catch (error) {
      toast.error("いいねに失敗しました");
    }
  };

  // コメント実行
  const handleComment = async (postUrlId: number) => {
    if (!selectedAccount) {
      toast.error("実行するアカウントを選択してください");
      return;
    }

    try {
      const result = await commentMutation.mutateAsync({
        postUrlId,
        fromAccountId: selectedAccount.id,
        fromDeviceId: selectedAccount.deviceId!,
      });
      if (result.success) {
        toast.success("コメントしました");
      } else {
        toast.error(`コメント失敗: ${result.error}`);
      }
    } catch (error) {
      toast.error("コメントに失敗しました");
    }
  };

  // リツイート実行
  const handleRetweet = async (postUrlId: number) => {
    if (!selectedAccount) {
      toast.error("実行するアカウントを選択してください");
      return;
    }

    try {
      const result = await retweetMutation.mutateAsync({
        postUrlId,
        fromAccountId: selectedAccount.id,
        fromDeviceId: selectedAccount.deviceId!,
      });
      if (result.success) {
        toast.success("リツイートしました");
      } else {
        const url = (result as any).usedUrl || "不明";
        toast.error(`リツイート失敗: ${result.error}\nURL: ${url}`);
        console.log("Retweet failed. Used URL:", url);
      }
    } catch (error) {
      toast.error("リツイートに失敗しました");
    }
  };

  // フォロー実行
  const handleFollow = async (postUrl: string) => {
    if (!selectedAccount) {
      toast.error("実行するアカウントを選択してください");
      return;
    }

    // URLからXハンドルを抽出 (https://x.com/username/status/...)
    const match = postUrl.match(/x\.com\/([^\/]+)\/status/);
    if (!match) {
      toast.error("投稿URLからユーザー名を取得できません");
      return;
    }
    const username = match[1];

    try {
      const result = await followMutation.mutateAsync({
        targetUsername: username,
        fromAccountId: selectedAccount.id,
        fromDeviceId: selectedAccount.deviceId!,
      });
      if (result.success) {
        toast.success(`@${username}をフォローしました`);
      } else {
        toast.error(`フォロー失敗: ${result.error}`);
      }
    } catch (error) {
      toast.error("フォローに失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      {/* 相互連携設定 */}
      <InteractionSettings projectId={projectId} />

      {/* アカウント間関係性 */}
      <AccountRelationships projectId={projectId} />

      {/* スケジューラー */}
      <SchedulerDashboard projectId={projectId} />

      {/* 投稿URL管理 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>投稿URL一覧</CardTitle>
          <div className="flex gap-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="アカウントを選択" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map(account => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    @{account.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleFetchLatest}
              disabled={!selectedAccount || fetchLatestMutation.isPending}
            >
              {fetchLatestMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              最新を取得
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 手動追加フォーム */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="投稿URL"
              value={newPostUrl}
              onChange={(e) => setNewPostUrl(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="ユーザー名（オプション）"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-40"
            />
            <Button onClick={handleAddPostUrl} disabled={addPostUrlMutation.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* 投稿URL一覧 */}
          <div className="space-y-2">
            {postUrls?.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-900">
                    <span className="text-slate-400 mr-2">#{post.id}</span>
                    @{post.username}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{post.postContent || post.postUrl}</p>
                  <p className="text-xs text-blue-500 truncate">{post.postUrl}</p>
                </div>
                <div className="flex gap-2 ml-4 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLike(post.id)}
                    disabled={!selectedAccount || likeMutation.isPending}
                  >
                    <Heart className="w-4 h-4 mr-1" />
                    いいね
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleComment(post.id)}
                    disabled={!selectedAccount || commentMutation.isPending}
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    コメント
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetweet(post.id)}
                    disabled={!selectedAccount || retweetMutation.isPending}
                  >
                    <Repeat2 className="w-4 h-4 mr-1" />
                    RT
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFollow(post.postUrl)}
                    disabled={!selectedAccount || followMutation.isPending}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    フォロー
                  </Button>
                </div>
              </div>
            ))}
            {postUrls?.length === 0 && (
              <p className="text-center text-slate-500 py-4">
                投稿URLがありません。「最新を取得」または手動で追加してください。
              </p>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
