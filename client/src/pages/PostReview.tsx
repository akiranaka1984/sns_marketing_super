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
      case "twitter": return "bg-[#87CEEB]";
      case "instagram": return "bg-[#FF6B6B]";
      case "tiktok": return "bg-[#1A1A1A]";
      case "facebook": return "bg-[#4ECDC4]";
      default: return "bg-[#6B6B6B]";
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
              <button
                className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                onClick={() => bulkApproveMutation.mutate({ postIds: selectedPosts })}
                disabled={bulkApproveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                {selectedPosts.length}件を承認
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-[#FF6B6B] px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                onClick={() => {
                  const reason = prompt("却下理由を入力してください");
                  if (reason) {
                    bulkRejectMutation.mutate({ postIds: selectedPosts, reason });
                  }
                }}
                disabled={bulkRejectMutation.isPending}
              >
                <XCircle className="h-4 w-4" />
                {selectedPosts.length}件を却下
              </button>
            </div>
          )}
        </div>

        {/* 統計 */}
        <div className="grid gap-3 grid-cols-3">
          <div className="fade-in-up bg-[#FFD700] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
            <div className="pl-3">
              <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">レビュー待ち</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{pendingPosts?.length || 0}</p>
            </div>
          </div>

          <div className="fade-in-up bg-[#DDA0DD] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
            <div className="pl-3">
              <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">エージェント</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                {new Set(pendingPosts?.map(p => p.agentId).filter(Boolean)).size}
              </p>
            </div>
          </div>

          <div className="fade-in-up bg-[#A8E6CF] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
            <div className="pl-3">
              <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">24時間以内</p>
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
        <div className="fade-in-up bg-white rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[#1A1A1A]">レビュー待ち投稿</h3>
            {pendingPosts && pendingPosts.length > 0 && (
              <button
                className="rounded-lg border-2 border-[#1A1A1A] bg-white px-3 py-1 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                onClick={handleSelectAll}
              >
                {selectedPosts.length === pendingPosts.length ? "選択解除" : "すべて選択"}
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="text-center py-8 text-[#6B6B6B] font-bold">読み込み中...</div>
          ) : !pendingPosts || pendingPosts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-[#A8E6CF] mb-4 border-2 border-[#1A1A1A] rounded-full p-2 bg-white" />
              <p className="text-lg font-bold text-[#1A1A1A]">レビュー待ちの投稿はありません</p>
              <p className="text-[#6B6B6B] font-bold">すべての投稿が処理されています</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPosts.map((post) => (
                <div
                  key={post.id}
                  className={`border-2 border-[#1A1A1A] rounded-lg p-4 shadow-[4px_4px_0_#1A1A1A] transition-colors ${
                    selectedPosts.includes(post.id) ? "bg-[#FFDAB9]" : "bg-white"
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border-2 border-[#1A1A1A] text-[11px] font-bold bg-[#87CEEB] text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                            <Bot className="h-3 w-3" />
                            {post.agent.name}
                          </span>
                        )}
                        {post.account && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border-2 border-[#1A1A1A] text-[11px] font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] ${getPlatformColor(post.account.platform)}`}>
                            @{post.account.username}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border-2 border-[#1A1A1A] text-[11px] font-bold bg-[#FFFDF7] text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.scheduledTime)}
                        </span>
                        {post.contentConfidence && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border-2 border-[#1A1A1A] text-[11px] font-bold bg-[#4ECDC4] text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                            <Sparkles className="h-3 w-3" />
                            信頼度: {post.contentConfidence}%
                          </span>
                        )}
                      </div>

                      {/* コンテンツ */}
                      <div className="bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg p-3 shadow-[2px_2px_0_#1A1A1A]">
                        <p className="whitespace-pre-wrap font-bold text-[#1A1A1A]">{post.content}</p>
                      </div>

                      {/* アクション */}
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] px-3 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                          onClick={() => approveMutation.mutate({ postId: post.id })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4" />
                          承認
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-white px-3 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                          onClick={() => {
                            setEditingPost(post);
                            setEditContent(post.content);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          編集
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-[#FF6B6B] px-3 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                          onClick={() => setRejectingPostId(post.id)}
                        >
                          <XCircle className="h-4 w-4" />
                          却下
                        </button>
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
        <DialogContent className="max-w-2xl border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A1A] font-bold">投稿を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              placeholder="投稿内容を編集..."
              className="border-2 border-[#1A1A1A]"
            />
            {editingPost?.originalContent && editingPost.originalContent !== editContent && (
              <div className="text-sm text-[#6B6B6B]">
                <p className="font-bold text-[#1A1A1A]">元のコンテンツ:</p>
                <p className="bg-[#FFFDF7] border-2 border-[#1A1A1A] p-2 rounded-lg mt-1 font-bold text-[#1A1A1A]">{editingPost.originalContent}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              className="rounded-lg border-2 border-[#1A1A1A] bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              onClick={() => setEditingPost(null)}
            >
              キャンセル
            </button>
            <button
              className="rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              onClick={() => {
                editMutation.mutate({
                  postId: editingPost.id,
                  content: editContent,
                });
              }}
              disabled={editMutation.isPending}
            >
              保存して承認待ちに戻す
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 却下ダイアログ */}
      <Dialog open={!!rejectingPostId} onOpenChange={() => setRejectingPostId(null)}>
        <DialogContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A1A] font-bold">投稿を却下</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="却下理由を入力..."
              className="border-2 border-[#1A1A1A]"
            />
          </div>
          <DialogFooter>
            <button
              className="rounded-lg border-2 border-[#1A1A1A] bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              onClick={() => setRejectingPostId(null)}
            >
              キャンセル
            </button>
            <button
              className="rounded-lg border-2 border-[#1A1A1A] bg-[#FF6B6B] px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
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
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
