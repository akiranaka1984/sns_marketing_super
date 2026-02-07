import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Edit,
  Clock,
  Bot,
  User,
  Calendar,
  Sparkles,
  AlertCircle
} from "lucide-react";

export default function PostReview() {
  const utils = trpc.useUtils();

  const [selectedPosts, setSelectedPosts] = useState<number[]>([]);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingPostId, setRejectingPostId] = useState<number | null>(null);

  // レビュー待ち投稿を取得
  const { data: pendingPosts, isLoading } = trpc.agentScheduledPosts.getPendingReview.useQuery({
    limit: 100,
  });

  // 承認
  const approveMutation = trpc.agentScheduledPosts.approve.useMutation({
    onSuccess: () => {
      toast.success("承認しました");
      utils.agentScheduledPosts.getPendingReview.invalidate();
    },
  });

  // 却下
  const rejectMutation = trpc.agentScheduledPosts.reject.useMutation({
    onSuccess: () => {
      toast.success("却下しました");
      utils.agentScheduledPosts.getPendingReview.invalidate();
      setRejectingPostId(null);
      setRejectReason("");
    },
  });

  // 編集
  const editMutation = trpc.agentScheduledPosts.edit.useMutation({
    onSuccess: () => {
      toast.success("編集を保存しました");
      utils.agentScheduledPosts.getPendingReview.invalidate();
      setEditingPost(null);
    },
  });

  // 一括承認
  const bulkApproveMutation = trpc.agentScheduledPosts.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved}件を承認しました`);
      utils.agentScheduledPosts.getPendingReview.invalidate();
      setSelectedPosts([]);
    },
  });

  // 一括却下
  const bulkRejectMutation = trpc.agentScheduledPosts.bulkReject.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.rejected}件を却下しました`);
      utils.agentScheduledPosts.getPendingReview.invalidate();
      setSelectedPosts([]);
    },
  });

  const handleSelectAll = () => {
    if (selectedPosts.length === pendingPosts?.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(pendingPosts?.map(p => p.id) || []);
    }
  };

  const handleSelectPost = (postId: number) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "twitter": return "bg-blue-500";
      case "instagram": return "bg-pink-500";
      case "tiktok": return "bg-black";
      case "facebook": return "bg-blue-600";
      default: return "bg-gray-500";
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="space-y-5 max-w-5xl">
        {/* ヘッダー */}
        <div className="fade-in-up page-header">
          <div>
            <h1 className="page-title">投稿レビュー</h1>
            <p className="page-subtitle">
              エージェントが生成した投稿を確認・承認します
            </p>
          </div>

          {selectedPosts.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => bulkApproveMutation.mutate({ postIds: selectedPosts })}
                disabled={bulkApproveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {selectedPosts.length}件を承認
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  const reason = prompt("却下理由を入力してください");
                  if (reason) {
                    bulkRejectMutation.mutate({ postIds: selectedPosts, reason });
                  }
                }}
                disabled={bulkRejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {selectedPosts.length}件を却下
              </Button>
            </div>
          )}
        </div>

        {/* 統計 */}
        <div className="grid gap-3 grid-cols-3">
          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#D97706' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">レビュー待ち</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{pendingPosts?.length || 0}</p>
            </div>
          </div>

          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#7C3AED' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">エージェント</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                {new Set(pendingPosts?.map(p => p.agentId).filter(Boolean)).size}
              </p>
            </div>
          </div>

          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#059669' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">24時間以内</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                {pendingPosts?.filter(p => {
                  const scheduledTime = new Date(p.scheduledTime);
                  const now = new Date();
                  const hoursDiff = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                  return hoursDiff < 24;
                }).length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 投稿一覧 */}
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[#1A1A1A]">レビュー待ち投稿</h3>
            {pendingPosts && pendingPosts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedPosts.length === pendingPosts.length ? "選択解除" : "すべて選択"}
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="text-center py-8 text-[#A3A3A3]">読み込み中...</div>
          ) : !pendingPosts || pendingPosts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
              <p className="text-lg font-medium">レビュー待ちの投稿はありません</p>
              <p className="text-[#A3A3A3]">すべての投稿が処理されています</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPosts.map((post) => (
                <div
                  key={post.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    selectedPosts.includes(post.id) ? "bg-[#FFF7ED] border-[#D4380D]" : ""
                  }`}
                >
                  <div className="flex gap-4">
                    <Checkbox
                      checked={selectedPosts.includes(post.id)}
                      onCheckedChange={() => handleSelectPost(post.id)}
                    />

                    <div className="flex-1 space-y-3">
                      {/* メタ情報 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.agent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">
                            <Bot className="h-3 w-3" />
                            {post.agent.name}
                          </span>
                        )}
                        {post.account && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-white ${getPlatformColor(post.account.platform)}`}>
                            @{post.account.username}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.scheduledTime)}
                        </span>
                        {post.contentConfidence && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">
                            <Sparkles className="h-3 w-3" />
                            信頼度: {post.contentConfidence}%
                          </span>
                        )}
                      </div>

                      {/* コンテンツ */}
                      <div className="bg-[#F5F5F5] rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{post.content}</p>
                      </div>

                      {/* アクション */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-[#D4380D] hover:bg-[#B8300B] text-white"
                          onClick={() => approveMutation.mutate({ postId: post.id })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          承認
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPost(post);
                            setEditContent(post.content);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => setRejectingPostId(post.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          却下
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 編集ダイアログ */}
      <Dialog open={!!editingPost} onOpenChange={() => setEditingPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>投稿を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              placeholder="投稿内容を編集..."
            />
            {editingPost?.originalContent && editingPost.originalContent !== editContent && (
              <div className="text-sm text-[#A3A3A3]">
                <p className="font-medium">元のコンテンツ:</p>
                <p className="bg-[#F5F5F5] p-2 rounded mt-1">{editingPost.originalContent}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPost(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                editMutation.mutate({
                  postId: editingPost.id,
                  content: editContent,
                });
              }}
              disabled={editMutation.isPending}
            >
              保存して承認待ちに戻す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 却下ダイアログ */}
      <Dialog open={!!rejectingPostId} onOpenChange={() => setRejectingPostId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>投稿を却下</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="却下理由を入力..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingPostId(null)}>
              キャンセル
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (rejectingPostId && rejectReason) {
                  rejectMutation.mutate({
                    postId: rejectingPostId,
                    reason: rejectReason,
                  });
                }
              }}
              disabled={!rejectReason || rejectMutation.isPending}
            >
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
