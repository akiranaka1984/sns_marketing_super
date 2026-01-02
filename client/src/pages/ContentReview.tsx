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
        return <Badge variant="secondary">審査待ち</Badge>;
      case "approved":
        return <Badge variant="default">承認済み</Badge>;
      case "rejected":
        return <Badge variant="destructive">却下</Badge>;
      case "revision_requested":
        return <Badge variant="outline">修正依頼</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">コンテンツ審査</h1>
        <p className="text-muted-foreground">
          リライトされたコンテンツを審査し、承認・却下・修正依頼を行います
        </p>
      </div>

      <div className="grid gap-4">
        {reviews?.map((review: any) => (
          <Card key={review.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>審査 #{review.id}</span>
                <div className="flex gap-2">
                  {getStatusBadge(review.status)}
                </div>
              </CardTitle>
              <CardDescription>
                {new Date(review.createdAt).toLocaleString("ja-JP")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-sm mb-2">コンテンツ:</p>
                  <p className="text-sm bg-muted p-4 rounded">{review.rewrite?.rewrittenContent || "コンテンツなし"}</p>
                </div>

                {review.feedback && (
                  <div>
                    <p className="font-medium text-sm mb-2">フィードバック:</p>
                    <p className="text-sm text-muted-foreground bg-muted p-4 rounded">
                      {review.feedback}
                    </p>
                  </div>
                )}

                {review.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveReview.mutate({ reviewId: review.id })}
                      disabled={approveReview.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      承認
                    </Button>
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
                        <Button size="sm" variant="outline">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          修正依頼
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>修正依頼</DialogTitle>
                          <DialogDescription>
                            修正内容を入力してください
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="feedback">修正内容</Label>
                            <Textarea
                              id="feedback"
                              placeholder="修正してほしい内容を入力..."
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              rows={5}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setFeedback("");
                            }}
                          >
                            キャンセル
                          </Button>
                          <Button
                            onClick={handleRequestRevision}
                            disabled={requestRevision.isPending}
                          >
                            修正依頼
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedReview(review);
                        setIsDialogOpen(true);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      却下
                    </Button>
                  </div>
                )}

                {review.reviewedAt && (
                  <p className="text-xs text-muted-foreground">
                    審査日時: {new Date(review.reviewedAt).toLocaleString("ja-JP")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!reviews || reviews.length === 0) && (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">審査待ちのコンテンツはありません</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
