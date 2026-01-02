import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Heart, MessageCircle, RefreshCw, Plus, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import InteractionSettings from "./InteractionSettings";
import SchedulerDashboard from "./SchedulerDashboard";

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
  const { data: history, refetch: refetchHistory } = trpc.interactions.getHistory.useQuery({ projectId });

  // ミューテーション
  const addPostUrlMutation = trpc.interactions.addPostUrl.useMutation();
  const fetchLatestMutation = trpc.interactions.fetchLatestPosts.useMutation();
  const likeMutation = trpc.interactions.executeLike.useMutation();
  const commentMutation = trpc.interactions.executeComment.useMutation();

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
      refetchHistory();
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
      refetchHistory();
    } catch (error) {
      toast.error("コメントに失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      {/* 相互連携設定 */}
      <InteractionSettings projectId={projectId} />

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
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">@{post.username}</p>
                  <p className="text-xs text-gray-500 truncate">{post.postContent || post.postUrl}</p>
                </div>
                <div className="flex gap-2 ml-4">
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
                </div>
              </div>
            ))}
            {postUrls?.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                投稿URLがありません。「最新を取得」または手動で追加してください。
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 実行履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>最近の実行履歴（24時間）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {history?.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 text-sm">
                <span>{item.actionType}</span>
                <div className="flex items-center gap-2">
                  {item.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {item.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
                  {item.status === "pending" && <Clock className="w-4 h-4 text-yellow-500" />}
                  <span className="text-gray-500 text-xs">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {history?.length === 0 && (
              <p className="text-center text-gray-500 py-4">実行履歴がありません</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
