import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">AI学習最適化</h1>
          <p className="page-subtitle">
            パフォーマンスデータに基づいてエージェントのパラメータを自動最適化します
          </p>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
        <h3 className="font-bold text-sm text-[#1A1A1A] mb-1">エージェント分析</h3>
        <p className="text-[11px] text-[#6B6B6B] mb-4 font-bold">エージェントのパフォーマンスを分析して最適化提案を生成します</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agent" className="font-bold">エージェント選択</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="border-2 border-[#1A1A1A] rounded-lg font-bold">
                <SelectValue placeholder="エージェントを選択" />
              </SelectTrigger>
              <SelectContent className="border-2 border-[#1A1A1A] rounded-lg">
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()} className="font-bold">
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
              className="w-full bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {analyzeAgent.isPending ? "分析中..." : "分析開始"}
            </Button>
          </div>
        </div>
      </div>

      {/* Optimizations List */}
      <div>
        <h3 className="font-bold text-sm text-[#1A1A1A] mb-3">最適化提案</h3>
        <div className="grid gap-4">
          {optimizations?.map((opt: any) => (
            <div key={opt.id} className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm text-[#1A1A1A]">最適化 #{opt.id}</h3>
                {opt.status === "applied" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A]">適用済み</span>
                ) : opt.status === "reverted" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]">元に戻した</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-white">未適用</span>
                )}
              </div>
              <p className="text-[11px] text-[#6B6B6B] mb-4 font-bold">
                {new Date(opt.createdAt).toLocaleString("ja-JP")}
              </p>
              <div className="space-y-4">
                {/* Before/After Comparison */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-bold text-sm mb-2">変更前</h4>
                    <div className="text-sm space-y-1 bg-[#FFF8DC] p-3 rounded-lg border-2 border-[#1A1A1A]">
                      <p className="font-bold"><span className="font-bold">トーン:</span> {opt.beforeParams?.tone || "N/A"}</p>
                      <p className="font-bold"><span className="font-bold">スタイル:</span> {opt.beforeParams?.style || "N/A"}</p>
                      <p className="font-bold"><span className="font-bold">投稿頻度:</span> {opt.beforeParams?.postingFrequency || "N/A"}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-2">変更後</h4>
                    <div className="text-sm space-y-1 bg-[#FFD700] p-3 rounded-lg border-2 border-[#1A1A1A]">
                      <p className="font-bold"><span className="font-bold">トーン:</span> {opt.afterParams?.tone || "N/A"}</p>
                      <p className="font-bold"><span className="font-bold">スタイル:</span> {opt.afterParams?.style || "N/A"}</p>
                      <p className="font-bold"><span className="font-bold">投稿頻度:</span> {opt.afterParams?.postingFrequency || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Expected Improvement */}
                {opt.performanceImprovement > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                      期待される改善: +{opt.performanceImprovement}%
                    </span>
                  </div>
                )}

                {/* Insights */}
                {opt.insights && (
                  <div>
                    <h4 className="font-bold text-sm mb-2">AI提案理由</h4>
                    <div className="text-sm space-y-2">
                      {opt.insights.toneAdjustment && (
                        <p className="text-[#6B6B6B] font-bold">
                          <span className="font-bold">トーン:</span> {opt.insights.toneAdjustment.reason}
                        </p>
                      )}
                      {opt.insights.styleAdjustment && (
                        <p className="text-[#6B6B6B] font-bold">
                          <span className="font-bold">スタイル:</span> {opt.insights.styleAdjustment.reason}
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
                      className="bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg"
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
                      className="bg-white hover:bg-[#FFF8DC] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      元に戻す
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(!optimizations || optimizations.length === 0) && (
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
              <div className="flex items-center justify-center h-32">
                <p className="text-[#6B6B6B] font-bold">最適化提案はありません</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
