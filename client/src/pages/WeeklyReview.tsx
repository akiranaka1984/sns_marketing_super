import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Calendar, TrendingUp, Lightbulb, Target, Sparkles, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function WeeklyReview() {
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [generatedReview, setGeneratedReview] = useState<any>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);

  const { data: agents } = trpc.agents.list.useQuery();

  const generateReview = trpc.weeklyReview.generateReview.useMutation({
    onSuccess: (data) => {
      toast.success("週次レビューを生成しました");
      setGeneratedReview(data);
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const autoOptimizeMutation = trpc.weeklyReview.autoOptimize.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setOptimizationResult(data);
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleGenerateReview = () => {
    if (!weekStartDate || !weekEndDate) {
      toast.error("期間を選択してください");
      return;
    }

    generateReview.mutate({
      weekStartDate: new Date(weekStartDate),
      weekEndDate: new Date(weekEndDate),
    });
  };

  const handleAutoOptimize = (autoApply: boolean) => {
    if (!selectedAgentId) {
      toast.error("エージェントを選択してください");
      return;
    }

    autoOptimizeMutation.mutate({
      agentId: selectedAgentId,
      daysBack: 7,
      autoApply,
    });
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">週次レビュー</h1>
          <p className="page-subtitle">
            週次のパフォーマンスデータを分析し、AI生成のインサイトと推奨事項を提供します
          </p>
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">レビュー期間選択</h3>
        <p className="text-xs text-[#A3A3A3] mb-3">分析したい週の開始日と終了日を選択してください</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="startDate">開始日</Label>
            <Input
              id="startDate"
              type="date"
              value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">終了日</Label>
            <Input
              id="endDate"
              type="date"
              value={weekEndDate}
              onChange={(e) => setWeekEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleGenerateReview}
              disabled={generateReview.isPending}
              className="w-full bg-[#D4380D] hover:bg-[#B8300B] text-white"
            >
              <Calendar className="mr-2 h-4 w-4" />
              {generateReview.isPending ? "生成中..." : "レビュー生成"}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Auto-Optimization */}
      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[#D4380D]" />
          <h3 className="font-semibold text-sm text-[#1A1A1A]">AI自動最適化</h3>
        </div>
        <p className="text-xs text-[#A3A3A3] mb-3">
          エージェントの投稿パフォーマンスを分析し、戦略を自動最適化します
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent">対象エージェント</Label>
            <Select
              value={selectedAgentId?.toString()}
              onValueChange={(value) => setSelectedAgentId(parseInt(value))}
            >
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

          <div className="flex gap-2">
            <Button
              onClick={() => handleAutoOptimize(false)}
              disabled={autoOptimizeMutation.isPending}
              variant="outline"
              className="flex-1"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              {autoOptimizeMutation.isPending ? "分析中..." : "提案のみ生成"}
            </Button>
            <Button
              onClick={() => handleAutoOptimize(true)}
              disabled={autoOptimizeMutation.isPending}
              className="flex-1 bg-[#D4380D] hover:bg-[#B8300B] text-white"
            >
              <Zap className="mr-2 h-4 w-4" />
              {autoOptimizeMutation.isPending ? "実行中..." : "自動最適化実行"}
            </Button>
          </div>
        </div>
      </div>

      {/* Optimization Results */}
      {optimizationResult && optimizationResult.success && (
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">最適化結果</h3>
          <div className="space-y-4">
            {/* Analysis Summary */}
            {optimizationResult.analysis && (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#D4380D' } as React.CSSProperties}>
                  <div className="pl-3">
                    <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">分析投稿数</p>
                    <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{optimizationResult.analysis.totalPosts}</p>
                  </div>
                </div>
                <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#D97706' } as React.CSSProperties}>
                  <div className="pl-3">
                    <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">平均エンゲージメント率</p>
                    <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{optimizationResult.analysis.avgEngagementRate.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#2563EB' } as React.CSSProperties}>
                  <div className="pl-3">
                    <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">インサイト数</p>
                    <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{optimizationResult.analysis.insightsCount}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {optimizationResult.suggestions && optimizationResult.suggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-[#1A1A1A]">最適化提案</h3>
                {optimizationResult.suggestions.map((suggestion: any, index: number) => (
                  <div key={index} className="border-l-4 border-l-[#D4380D] bg-white rounded-lg border border-[#E5E5E5] p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1 text-sm text-[#1A1A1A]">{suggestion.title}</h4>
                        <p className="text-xs text-[#A3A3A3] mb-2">{suggestion.description}</p>
                        <div className="flex gap-2">
                          <span className="inline-flex items-center rounded-md border border-[#E5E5E5] px-2 py-0.5 text-[10px] font-medium text-[#1A1A1A]">
                            期待改善: +{suggestion.expectedImprovement}%
                          </span>
                          <span className="inline-flex items-center rounded-md bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-medium text-[#737373]">
                            信頼度: {suggestion.confidence}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Applied Results */}
            {optimizationResult.applied && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md p-3 text-xs">
                <p className="font-medium">
                  {optimizationResult.applied.applied}件の最適化を適用しました
                </p>
                {optimizationResult.applied.failed > 0 && (
                  <p className="text-red-600 mt-1">
                    {optimizationResult.applied.failed}件の適用に失敗しました
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated Review */}
      {generatedReview && (
        <div className="space-y-5">
          {/* Summary Stats */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#D4380D' } as React.CSSProperties}>
              <div className="pl-3">
                <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">総投稿数</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{generatedReview.totalPosts}</p>
              </div>
            </div>
            <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#2563EB' } as React.CSSProperties}>
              <div className="pl-3">
                <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">総視聴数</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                  {generatedReview.totalViews?.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#059669' } as React.CSSProperties}>
              <div className="pl-3">
                <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">総いいね</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                  {generatedReview.totalLikes?.toLocaleString() || 0}
                </p>
              </div>
            </div>
            <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#D97706' } as React.CSSProperties}>
              <div className="pl-3">
                <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">平均エンゲージメント率</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                  {generatedReview.avgEngagement?.toFixed(2) || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          {generatedReview.insights && (
            <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="h-4 w-4 text-[#D4380D]" />
                <h3 className="font-semibold text-sm text-[#1A1A1A]">AIインサイト</h3>
              </div>
              <p className="text-xs text-[#A3A3A3] mb-3">AIが分析したパフォーマンスの洞察</p>
              <div className="space-y-4">
                {generatedReview.insights.topPerformingContent && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-[#1A1A1A]">
                      <TrendingUp className="h-4 w-4" />
                      トップパフォーマンスコンテンツ
                    </h4>
                    <p className="text-xs text-[#A3A3A3]">
                      {generatedReview.insights.topPerformingContent}
                    </p>
                  </div>
                )}
                {generatedReview.insights.engagementTrends && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">エンゲージメントトレンド</h4>
                    <p className="text-xs text-[#A3A3A3]">
                      {generatedReview.insights.engagementTrends}
                    </p>
                  </div>
                )}
                {generatedReview.insights.audienceBehavior && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">オーディエンス行動</h4>
                    <p className="text-xs text-[#A3A3A3]">
                      {generatedReview.insights.audienceBehavior}
                    </p>
                  </div>
                )}
                {generatedReview.insights.contentGaps && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">コンテンツギャップ</h4>
                    <p className="text-xs text-[#A3A3A3]">
                      {generatedReview.insights.contentGaps}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {generatedReview.recommendations && (
            <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-[#D4380D]" />
                <h3 className="font-semibold text-sm text-[#1A1A1A]">推奨事項</h3>
              </div>
              <p className="text-xs text-[#A3A3A3] mb-3">次週に向けた改善提案</p>
              <div className="space-y-4">
                {generatedReview.recommendations.contentStrategy && generatedReview.recommendations.contentStrategy.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">コンテンツ戦略</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {generatedReview.recommendations.contentStrategy.map((item: string, idx: number) => (
                        <li key={idx} className="text-xs text-[#A3A3A3]">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {generatedReview.recommendations.postingSchedule && generatedReview.recommendations.postingSchedule.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">投稿スケジュール</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {generatedReview.recommendations.postingSchedule.map((item: string, idx: number) => (
                        <li key={idx} className="text-xs text-[#A3A3A3]">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {generatedReview.recommendations.engagementTactics && generatedReview.recommendations.engagementTactics.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">エンゲージメント戦術</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {generatedReview.recommendations.engagementTactics.map((item: string, idx: number) => (
                        <li key={idx} className="text-xs text-[#A3A3A3]">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {generatedReview.recommendations.platformOptimization && generatedReview.recommendations.platformOptimization.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-[#1A1A1A]">プラットフォーム最適化</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {generatedReview.recommendations.platformOptimization.map((item: string, idx: number) => (
                        <li key={idx} className="text-xs text-[#A3A3A3]">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!generatedReview && (
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <div className="flex items-center justify-center h-64">
            <p className="text-[#A3A3A3] text-sm">
              期間を選択してレビューを生成してください
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
