import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Check, X, RotateCcw } from "lucide-react";

export default function AIOptimization() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const { data: agents } = trpc.agents.list.useQuery();
  const { data: optimizations, refetch } = trpc.aiOptimization.listOptimizations.useQuery({ limit: 20 });

  const analyzeAgent = trpc.aiOptimization.analyzeAgent.useMutation({
    onSuccess: () => {
      toast.success("エージェントの分析が完了しました");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const applyOptimization = trpc.aiOptimization.applyOptimization.useMutation({
    onSuccess: () => {
      toast.success("最適化を適用しました");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const revertOptimization = trpc.aiOptimization.revertOptimization.useMutation({
    onSuccess: () => {
      toast.success("最適化を元に戻しました");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleAnalyze = () => {
    if (!selectedAgentId) {
      toast.error("エージェントを選択してください");
      return;
    }

    analyzeAgent.mutate({
      agentId: parseInt(selectedAgentId),
      daysBack: 30,
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI学習最適化</h1>
        <p className="text-muted-foreground">
          パフォーマンスデータに基づいてエージェントのパラメータを自動最適化します
        </p>
      </div>

      {/* Analysis Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>エージェント分析</CardTitle>
          <CardDescription>エージェントのパフォーマンスを分析して最適化提案を生成します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent">エージェント選択</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="エージェントを選択" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAnalyze}
                disabled={analyzeAgent.isPending}
                className="w-full"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {analyzeAgent.isPending ? "分析中..." : "分析開始"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimizations List */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">最適化提案</h2>
        <div className="grid gap-4">
          {optimizations?.map((opt: any) => (
            <Card key={opt.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>最適化 #{opt.id}</span>
                  <Badge
                    variant={
                      opt.status === "applied"
                        ? "default"
                        : opt.status === "reverted"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {opt.status === "pending" && "未適用"}
                    {opt.status === "applied" && "適用済み"}
                    {opt.status === "reverted" && "元に戻した"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {new Date(opt.createdAt).toLocaleString("ja-JP")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Before/After Comparison */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold mb-2">変更前</h4>
                      <div className="text-sm space-y-1 bg-muted p-3 rounded">
                        <p><span className="font-medium">トーン:</span> {opt.beforeParams?.tone || "N/A"}</p>
                        <p><span className="font-medium">スタイル:</span> {opt.beforeParams?.style || "N/A"}</p>
                        <p><span className="font-medium">投稿頻度:</span> {opt.beforeParams?.postingFrequency || "N/A"}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">変更後</h4>
                      <div className="text-sm space-y-1 bg-muted p-3 rounded">
                        <p><span className="font-medium">トーン:</span> {opt.afterParams?.tone || "N/A"}</p>
                        <p><span className="font-medium">スタイル:</span> {opt.afterParams?.style || "N/A"}</p>
                        <p><span className="font-medium">投稿頻度:</span> {opt.afterParams?.postingFrequency || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Expected Improvement */}
                  {opt.performanceImprovement > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">
                        期待される改善: +{opt.performanceImprovement}%
                      </Badge>
                    </div>
                  )}

                  {/* Insights */}
                  {opt.insights && (
                    <div>
                      <h4 className="font-semibold mb-2">AI提案理由</h4>
                      <div className="text-sm space-y-2">
                        {opt.insights.toneAdjustment && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">トーン:</span> {opt.insights.toneAdjustment.reason}
                          </p>
                        )}
                        {opt.insights.styleAdjustment && (
                          <p className="text-muted-foreground">
                            <span className="font-medium">スタイル:</span> {opt.insights.styleAdjustment.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {opt.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => applyOptimization.mutate({ optimizationId: opt.id })}
                        disabled={applyOptimization.isPending}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        適用
                      </Button>
                    )}
                    {opt.status === "applied" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revertOptimization.mutate({ optimizationId: opt.id })}
                        disabled={revertOptimization.isPending}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        元に戻す
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!optimizations || optimizations.length === 0) && (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">最適化提案はありません</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
