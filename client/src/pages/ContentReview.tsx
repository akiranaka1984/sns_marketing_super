import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, MessageSquare } from "lucide-react";
import { useState } from "react";

export default function ContentReview() {
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [feedback, setFeedback] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: reviews, refetch } = trpc.contentReview.listReviews.useQuery({ limit: 50 });

  const approveReview = trpc.contentReview.approveContent.useMutation({
    onSuccess: () => {
      toast.success("コンテンツを承認しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const rejectReview = trpc.contentReview.rejectContent.useMutation({
    onSuccess: () => {
      toast.success("コンテンツを却下しました");
      setIsDialogOpen(false);
      setFeedback("");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const requestRevision = trpc.contentReview.requestRevision.useMutation({
    onSuccess: () => {
      toast.success("修正を依頼しました");
      setIsDialogOpen(false);
      setFeedback("");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleReject = () => {
    if (!selectedReview) return;
    rejectReview.mutate({
      reviewId: selectedReview.id,
      feedback: feedback.trim() || "却下されました",
    });
  };

  const handleRequestRevision = () => {
    if (!selectedReview) return;
    if (!feedback.trim()) {
      toast.error("修正内容を入力してください");
      return;
    }
    requestRevision.mutate({
      reviewId: selectedReview.id,
      feedback: feedback.trim(),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="inline-flex items-center rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] px-2 py-0.5 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">審査待ち</span>;
      case "approved":
        return <span className="inline-flex items-center rounded-lg border-2 border-[#1A1A1A] bg-[#A8E6CF] px-2 py-0.5 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">承認済み</span>;
      case "rejected":
        return <span className="inline-flex items-center rounded-lg border-2 border-[#1A1A1A] bg-[#FF6B6B] px-2 py-0.5 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">却下</span>;
      case "revision_requested":
        return <span className="inline-flex items-center rounded-lg border-2 border-[#1A1A1A] bg-[#FFDAB9] px-2 py-0.5 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">修正依頼</span>;
      default:
        return <span className="inline-flex items-center rounded-lg border-2 border-[#1A1A1A] bg-[#FFFDF7] px-2 py-0.5 text-xs font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">{status}</span>;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1A1A1A]">コンテンツ審査</h1>
        <p className="text-[#6B6B6B] font-bold">
          リライトされたコンテンツを審査し、承認・却下・修正依頼を行います
        </p>
      </div>

      <div className="grid gap-4">
        {reviews?.map((review: any) => (
          <div key={review.id} className="bg-white rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
            <div className="p-6 border-b-2 border-[#1A1A1A] bg-[#4ECDC4]">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-[#1A1A1A]">審査 #{review.id}</span>
                <div className="flex gap-2">
                  {getStatusBadge(review.status)}
                </div>
              </div>
              <p className="text-sm text-[#1A1A1A] font-bold mt-1">
                {new Date(review.createdAt).toLocaleString("ja-JP")}
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-sm mb-2 text-[#1A1A1A]">コンテンツ:</p>
                  <p className="text-sm bg-[#FFFDF7] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[2px_2px_0_#1A1A1A] font-bold text-[#1A1A1A]">{review.rewrite?.rewrittenContent || "コンテンツなし"}</p>
                </div>

                {review.feedback && (
                  <div>
                    <p className="font-bold text-sm mb-2 text-[#1A1A1A]">フィードバック:</p>
                    <p className="text-sm text-[#6B6B6B] bg-[#FFF8DC] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[2px_2px_0_#1A1A1A] font-bold">
                      {review.feedback}
                    </p>
                  </div>
                )}

                {review.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] px-3 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                      onClick={() => approveReview.mutate({ reviewId: review.id })}
                      disabled={approveReview.isPending}
                    >
                      <Check className="h-4 w-4" />
                      承認
                    </button>
                    <Dialog
                      open={isDialogOpen && selectedReview?.id === review.id}
                      onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (open) setSelectedReview(review);
                        else {
                          setSelectedReview(null);
                          setFeedback("");
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <button className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-white px-3 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                          <MessageSquare className="h-4 w-4" />
                          修正依頼
                        </button>
                      </DialogTrigger>
                      <DialogContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                        <DialogHeader>
                          <DialogTitle className="text-[#1A1A1A] font-bold">修正依頼</DialogTitle>
                          <DialogDescription className="text-[#6B6B6B] font-bold">
                            修正内容を入力してください
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="feedback" className="text-[#1A1A1A] font-bold">修正内容</Label>
                            <Textarea
                              id="feedback"
                              placeholder="修正してほしい内容を入力..."
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              rows={5}
                              className="border-2 border-[#1A1A1A]"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <button
                            className="rounded-lg border-2 border-[#1A1A1A] bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setFeedback("");
                            }}
                          >
                            キャンセル
                          </button>
                          <button
                            className="rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                            onClick={handleRequestRevision}
                            disabled={requestRevision.isPending}
                          >
                            修正依頼
                          </button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1A1A1A] bg-[#FF6B6B] px-3 py-2 text-sm font-bold text-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                      onClick={() => {
                        setSelectedReview(review);
                        setIsDialogOpen(true);
                      }}
                    >
                      <X className="h-4 w-4" />
                      却下
                    </button>
                  </div>
                )}

                {review.reviewedAt && (
                  <p className="text-xs text-[#6B6B6B] font-bold">
                    審査日時: {new Date(review.reviewedAt).toLocaleString("ja-JP")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {(!reviews || reviews.length === 0) && (
          <div className="bg-white rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
            <div className="flex items-center justify-center h-32">
              <p className="text-[#6B6B6B] font-bold">審査待ちのコンテンツはありません</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
