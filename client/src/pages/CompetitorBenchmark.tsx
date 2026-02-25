import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Target, Lightbulb, BarChart3, Users, ArrowRight } from "lucide-react";

export default function CompetitorBenchmark() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);

  // Fetch comparison data
  const {
    data: comparison,
    isLoading: comparisonLoading,
    isError: comparisonError,
  } = trpc.analytics.getCompetitorComparison.useQuery({
    accountId: selectedAccountId,
    projectId: selectedProjectId,
  });

  // Fetch gap analysis data
  const {
    data: gapAnalysis,
    isLoading: gapLoading,
    isError: gapError,
  } = trpc.analytics.getGapAnalysis.useQuery({
    accountId: selectedAccountId,
    projectId: selectedProjectId,
  });

  if (comparisonLoading && gapLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1A1A1A]">競合比較</h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5 font-bold">モデルアカウントとの比較分析</p>
        </div>
      </div>

      {/* Section 1: Comparison Overview */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#1A1A1A]" />
          比較概要
        </h3>

        {comparisonLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
          </div>
        ) : comparisonError ? (
          <div className="text-center py-8 text-[#6B6B6B] text-sm font-bold">
            比較データを読み込めませんでした
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Your Account Card */}
            <div className="rounded-lg border-2 border-[#1A1A1A] p-4 bg-[#87CEEB] shadow-[2px_2px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-[#1A1A1A]" />
                <h4 className="text-sm font-bold text-[#1A1A1A]">自アカウント</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#1A1A1A] font-bold">総投稿数</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {comparison?.myStats?.totalPosts ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#1A1A1A] font-bold">平均いいね</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {comparison?.myStats?.avgLikes ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#1A1A1A] font-bold">平均エンゲージメント率</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {comparison?.myStats?.avgEngagementRate != null
                      ? `${(comparison.myStats.avgEngagementRate * 100).toFixed(2)}%`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Model Account Card */}
            <div className="rounded-lg border-2 border-[#1A1A1A] p-4 bg-[#FFD700] shadow-[2px_2px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-[#1A1A1A]" />
                <h4 className="text-sm font-bold text-[#1A1A1A]">モデルアカウント</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#1A1A1A] font-bold">アカウント数</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {comparison?.modelStats?.accountCount ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#1A1A1A] font-bold">平均投稿頻度 (投稿/週)</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {comparison?.modelStats?.avgPostsPerWeek ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#1A1A1A] font-bold">平均エンゲージメント率</span>
                  <span className="text-sm font-bold text-[#1A1A1A]">
                    {comparison?.modelStats?.avgEngagementRate != null
                      ? `${comparison.modelStats.avgEngagementRate}%`
                      : "-"}
                  </span>
                </div>
                {comparison?.modelStats?.topModels && comparison.modelStats.topModels.length > 0 && (
                  <div>
                    <span className="text-xs text-[#1A1A1A] font-bold">トップモデル</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {comparison.modelStats.topModels.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-white"
                        >
                          @{m.handle}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Gap Analysis */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
          ギャップ分析
        </h3>

        {gapLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
          </div>
        ) : gapError ? (
          <div className="text-center py-8 text-[#6B6B6B] text-sm font-bold">
            ギャップ分析データを読み込めませんでした
          </div>
        ) : !gapAnalysis?.gaps || gapAnalysis.gaps.length === 0 ? (
          <div className="text-center py-8 text-[#6B6B6B] text-sm font-bold">
            ギャップ分析データがありません
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {gapAnalysis.gaps.map((gap, index) => {
              const isNegativeGap = gap.gapPercentage < 0;
              return (
                <div
                  key={index}
                  className="rounded-lg border-2 border-[#1A1A1A] p-4 hover:bg-[#FFF8DC] transition-colors bg-white shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[#1A1A1A]">{gap.metric}</span>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={gap.priority as "high" | "medium" | "low"} />
                      {gap.gapPercentage !== 0 && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            isNegativeGap ? "text-[#FF6B6B]" : "text-[#A8E6CF]"
                          }`}
                        >
                          {isNegativeGap ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {gap.gapPercentage > 0 ? "+" : ""}
                          {gap.gapPercentage}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wide font-bold">自分</p>
                      <p className="text-lg font-bold text-[#1A1A1A]">{gap.myValue}</p>
                    </div>
                    {gap.modelValue > 0 && (
                      <>
                        <ArrowRight className="h-4 w-4 text-[#6B6B6B] shrink-0" />
                        <div className="text-center flex-1">
                          <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wide font-bold">モデル</p>
                          <p className="text-lg font-bold text-[#1A1A1A]">{gap.modelValue}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="bg-[#FFDAB9] rounded-lg p-2 border-2 border-[#1A1A1A]">
                    <p className="text-[11px] text-[#1A1A1A] flex items-start gap-1 font-bold">
                      <Lightbulb className="h-3 w-3 text-[#1A1A1A] shrink-0 mt-0.5" />
                      {gap.recommendation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const config: Record<
    string,
    { label: string; variant: "rose" | "amber" | "slate" }
  > = {
    high: { label: "高", variant: "rose" },
    medium: { label: "中", variant: "amber" },
    low: { label: "低", variant: "slate" },
  };

  const { label, variant } = config[priority] || config.low;

  return <Badge variant={variant}>{label}</Badge>;
}
