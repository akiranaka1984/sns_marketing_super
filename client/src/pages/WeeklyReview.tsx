import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Calendar,
  TrendingUp,
  Lightbulb,
  Target,
  Sparkles,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper to format numbers compactly
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

// Helper to get change indicator
function ChangeIndicator({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#6B6B6B] font-bold">
        <Minus className="h-3 w-3" />
        変化なし
      </span>
    );
  }
  const change = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#6B6B6B] font-bold">
        <Minus className="h-3 w-3" />
        変化なし
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? "text-[#1A1A1A]" : "text-[#1A1A1A]"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isPositive ? "+" : ""}{change.toFixed(1)}%{suffix}
    </span>
  );
}

// Priority badge for recommendations
function PriorityBadge({ index }: { index: number }) {
  const colors = [
    "bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A]",
    "bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A]",
    "bg-[#87CEEB] text-[#1A1A1A] border-2 border-[#1A1A1A]",
    "bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]",
  ];
  const labels = ["高", "中", "低", "参考"];
  const colorClass = colors[Math.min(index, colors.length - 1)];
  const label = labels[Math.min(index, labels.length - 1)];

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#1A1A1A] ${colorClass}`}>
      {label}
    </span>
  );
}

export default function WeeklyReview() {
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [generatedReview, setGeneratedReview] = useState<any>(null);
  const [previousWeekReview, setPreviousWeekReview] = useState<any>(null);
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

  const generatePreviousWeekReview = trpc.weeklyReview.generateReview.useMutation({
    onSuccess: (data) => {
      setPreviousWeekReview(data);
    },
    onError: () => {
      // Silently fail for comparison data
      setPreviousWeekReview(null);
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

  // Calculate the previous week dates for comparison
  const previousWeekDates = useMemo(() => {
    if (!weekStartDate || !weekEndDate) return null;
    const start = new Date(weekStartDate);
    const end = new Date(weekEndDate);
    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1); // day before current start
    const prevStart = new Date(prevEnd.getTime() - diff);
    return {
      startDate: prevStart.toISOString().split("T")[0],
      endDate: prevEnd.toISOString().split("T")[0],
    };
  }, [weekStartDate, weekEndDate]);

  const handleGenerateReview = () => {
    if (!weekStartDate || !weekEndDate) {
      toast.error("期間を選択してください");
      return;
    }

    // Generate current week review
    generateReview.mutate({
      weekStartDate: new Date(weekStartDate),
      weekEndDate: new Date(weekEndDate),
    });

    // Also generate previous week for comparison
    if (previousWeekDates) {
      generatePreviousWeekReview.mutate({
        weekStartDate: new Date(previousWeekDates.startDate),
        weekEndDate: new Date(previousWeekDates.endDate),
      });
    }
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

  // Quick date presets
  const setThisWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setWeekStartDate(monday.toISOString().split("T")[0]);
    setWeekEndDate(sunday.toISOString().split("T")[0]);
  };

  const setLastWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    setWeekStartDate(lastMonday.toISOString().split("T")[0]);
    setWeekEndDate(lastSunday.toISOString().split("T")[0]);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Page Header */}
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title font-bold text-[#1A1A1A]">週次レビュー</h1>
          <p className="page-subtitle font-bold text-[#6B6B6B]">
            週次のパフォーマンスデータを分析し、AI生成のインサイトと推奨事項を提供します
          </p>
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="h-4 w-4 text-[#1A1A1A]" />
          <h3 className="font-bold text-sm text-[#1A1A1A]">レビュー期間選択</h3>
        </div>
        <p className="text-xs text-[#6B6B6B] font-bold mb-4">分析したい週の開始日と終了日を選択してください</p>

        {/* Quick Presets */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={setThisWeek}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#1A1A1A] bg-[#FFF8DC] border-2 border-[#1A1A1A] hover:bg-[#FFD700] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            今週
          </button>
          <button
            onClick={setLastWeek}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#1A1A1A] bg-[#FFF8DC] border-2 border-[#1A1A1A] hover:bg-[#FFD700] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            先週
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-[#1A1A1A] font-bold">開始日</Label>
            <Input
              id="startDate"
              type="date"
              value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)}
              className="border-2 border-[#1A1A1A] bg-[#FFFDF7] text-[#1A1A1A] font-bold rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-[#1A1A1A] font-bold">終了日</Label>
            <Input
              id="endDate"
              type="date"
              value={weekEndDate}
              onChange={(e) => setWeekEndDate(e.target.value)}
              className="border-2 border-[#1A1A1A] bg-[#FFFDF7] text-[#1A1A1A] font-bold rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleGenerateReview}
              disabled={generateReview.isPending}
              className="w-full bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {generateReview.isPending ? "生成中..." : "レビュー生成"}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Auto-Optimization */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[#1A1A1A]" />
          <h3 className="font-bold text-sm text-[#1A1A1A]">AI自動最適化</h3>
        </div>
        <p className="text-xs text-[#6B6B6B] font-bold mb-4">
          エージェントの投稿パフォーマンスを分析し、戦略を自動最適化します
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent" className="text-[#1A1A1A] font-bold">対象エージェント</Label>
            <Select
              value={selectedAgentId?.toString()}
              onValueChange={(value) => setSelectedAgentId(parseInt(value))}
            >
              <SelectTrigger className="border-2 border-[#1A1A1A] bg-[#FFFDF7] text-[#1A1A1A] font-bold rounded-lg">
                <SelectValue placeholder="エージェントを選択" />
              </SelectTrigger>
              <SelectContent className="border-2 border-[#1A1A1A] bg-[#FFFDF7]">
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()} className="text-[#1A1A1A] font-bold focus:bg-[#FFF8DC]">
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
              className="flex-1 border-2 border-[#1A1A1A] text-[#1A1A1A] font-bold bg-[#FFFDF7] hover:bg-[#FFF8DC] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              {autoOptimizeMutation.isPending ? "分析中..." : "提案のみ生成"}
            </Button>
            <Button
              onClick={() => handleAutoOptimize(true)}
              disabled={autoOptimizeMutation.isPending}
              className="flex-1 bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <Zap className="mr-2 h-4 w-4" />
              {autoOptimizeMutation.isPending ? "実行中..." : "自動最適化実行"}
            </Button>
          </div>
        </div>
      </div>

      {/* Optimization Results */}
      {optimizationResult && optimizationResult.success && (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-[#1A1A1A]" />
            <h3 className="font-bold text-sm text-[#1A1A1A]">最適化結果</h3>
          </div>
          <div className="space-y-4">
            {/* Analysis Summary */}
            {optimizationResult.analysis && (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                <div className="fade-in-up bg-[#DDA0DD] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
                  <div className="pl-3">
                    <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">分析投稿数</p>
                    <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{optimizationResult.analysis.totalPosts}</p>
                  </div>
                </div>
                <div className="fade-in-up bg-[#FFDAB9] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
                  <div className="pl-3">
                    <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">平均エンゲージメント率</p>
                    <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{optimizationResult.analysis.avgEngagementRate.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="fade-in-up bg-[#A8E6CF] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
                  <div className="pl-3">
                    <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">インサイト数</p>
                    <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{optimizationResult.analysis.insightsCount}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {optimizationResult.suggestions && optimizationResult.suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-[#1A1A1A]" />
                  最適化提案
                </h4>
                {optimizationResult.suggestions.map((suggestion: any, index: number) => (
                  <div
                    key={index}
                    className="relative bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <PriorityBadge index={index} />
                          <h5 className="font-bold text-sm text-[#1A1A1A]">{suggestion.title}</h5>
                        </div>
                        <p className="text-xs text-[#6B6B6B] font-bold mb-3 leading-relaxed">{suggestion.description}</p>
                        <div className="flex gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#A8E6CF] border-2 border-[#1A1A1A] px-2 py-0.5 text-[10px] font-bold text-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                            <ArrowUpRight className="h-3 w-3" />
                            期待改善: +{suggestion.expectedImprovement}%
                          </span>
                          <span className="inline-flex items-center rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] px-2 py-0.5 text-[10px] font-bold text-[#6B6B6B]">
                            信頼度: {suggestion.confidence}%
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#6B6B6B] flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Applied Results */}
            {optimizationResult.applied && (
              <div className="flex items-start gap-3 bg-[#A8E6CF] border-2 border-[#1A1A1A] rounded-lg p-4 shadow-[4px_4px_0_#1A1A1A]">
                <CheckCircle2 className="h-5 w-5 text-[#1A1A1A] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-[#1A1A1A]">
                    {optimizationResult.applied.applied}件の最適化を適用しました
                  </p>
                  {optimizationResult.applied.failed > 0 && (
                    <p className="text-xs text-[#1A1A1A] font-bold mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {optimizationResult.applied.failed}件の適用に失敗しました
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated Review Results */}
      {generatedReview && (
        <div className="space-y-5">
          {/* Section Title */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[#1A1A1A]" />
            <span className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider px-2">レビュー結果</span>
            <div className="h-px flex-1 bg-[#1A1A1A]" />
          </div>

          {/* Summary Metrics - Current Week */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="fade-in-up bg-[#DDA0DD] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
              <div className="pl-3">
                <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総投稿数</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{generatedReview.totalPosts}</p>
                {previousWeekReview && (
                  <div className="mt-1">
                    <ChangeIndicator current={generatedReview.totalPosts} previous={previousWeekReview.totalPosts} />
                  </div>
                )}
              </div>
            </div>
            <div className="fade-in-up bg-[#87CEEB] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
              <div className="pl-3">
                <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総視聴数</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                  {formatNumber(generatedReview.totalViews || 0)}
                </p>
                {previousWeekReview && (
                  <div className="mt-1">
                    <ChangeIndicator current={generatedReview.totalViews || 0} previous={previousWeekReview.totalViews || 0} />
                  </div>
                )}
              </div>
            </div>
            <div className="fade-in-up bg-[#A8E6CF] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
              <div className="pl-3">
                <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総いいね</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                  {formatNumber(generatedReview.totalLikes || 0)}
                </p>
                {previousWeekReview && (
                  <div className="mt-1">
                    <ChangeIndicator current={generatedReview.totalLikes || 0} previous={previousWeekReview.totalLikes || 0} />
                  </div>
                )}
              </div>
            </div>
            <div className="fade-in-up bg-[#FFD700] border-2 border-[#1A1A1A] p-4 rounded-lg shadow-[4px_4px_0_#1A1A1A]">
              <div className="pl-3">
                <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">平均エンゲージメント率</p>
                <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                  {generatedReview.avgEngagement?.toFixed(2) || 0}%
                </p>
                {previousWeekReview && (
                  <div className="mt-1">
                    <ChangeIndicator current={generatedReview.avgEngagement || 0} previous={previousWeekReview.avgEngagement || 0} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Weekly Comparison Table */}
          {previousWeekReview && (
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">週間比較</h3>
                <span className="text-[10px] text-[#6B6B6B] font-bold ml-auto">今週 vs 先週</span>
              </div>
              <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-0 bg-[#FFD700] text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wide border-b-2 border-[#1A1A1A]">
                  <div className="px-4 py-2.5">指標</div>
                  <div className="px-4 py-2.5 text-right">先週</div>
                  <div className="px-4 py-2.5 text-right">今週</div>
                  <div className="px-4 py-2.5 text-right">変化</div>
                </div>
                {[
                  {
                    label: "投稿数",
                    icon: FileText,
                    current: generatedReview.totalPosts || 0,
                    previous: previousWeekReview.totalPosts || 0,
                    format: (v: number) => v.toString(),
                  },
                  {
                    label: "視聴数",
                    icon: BarChart3,
                    current: generatedReview.totalViews || 0,
                    previous: previousWeekReview.totalViews || 0,
                    format: formatNumber,
                  },
                  {
                    label: "いいね数",
                    icon: Target,
                    current: generatedReview.totalLikes || 0,
                    previous: previousWeekReview.totalLikes || 0,
                    format: formatNumber,
                  },
                  {
                    label: "エンゲージメント率",
                    icon: TrendingUp,
                    current: generatedReview.avgEngagement || 0,
                    previous: previousWeekReview.avgEngagement || 0,
                    format: (v: number) => v.toFixed(2) + "%",
                  },
                ].map((row, i) => {
                  const change = row.previous === 0
                    ? (row.current > 0 ? 100 : 0)
                    : ((row.current - row.previous) / row.previous) * 100;
                  const isPositive = change > 0;
                  const isNeutral = change === 0;

                  return (
                    <div key={i} className="grid grid-cols-4 gap-0 border-t-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors bg-[#FFFDF7]">
                      <div className="px-4 py-3 flex items-center gap-2">
                        <row.icon className="h-3.5 w-3.5 text-[#1A1A1A]" />
                        <span className="text-sm font-bold text-[#1A1A1A]">{row.label}</span>
                      </div>
                      <div className="px-4 py-3 text-right text-sm text-[#6B6B6B] font-bold">
                        {row.format(row.previous)}
                      </div>
                      <div className="px-4 py-3 text-right text-sm font-bold text-[#1A1A1A]">
                        {row.format(row.current)}
                      </div>
                      <div className="px-4 py-3 text-right">
                        {isNeutral ? (
                          <span className="text-xs text-[#6B6B6B] font-bold">--</span>
                        ) : (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-bold text-[#1A1A1A]`}>
                            {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {isPositive ? "+" : ""}{change.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {generatedReview.insights && (
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="h-4 w-4 text-[#1A1A1A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">AIインサイト</h3>
              </div>
              <p className="text-xs text-[#6B6B6B] font-bold mb-4">AIが分析したパフォーマンスの洞察</p>
              <div className="grid gap-3 md:grid-cols-2">
                {generatedReview.insights.topPerformingContent && (
                  <div className="p-4 rounded-lg bg-[#A8E6CF] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <h4 className="font-bold text-sm text-[#1A1A1A]">
                        トップパフォーマンスコンテンツ
                      </h4>
                    </div>
                    <p className="text-xs text-[#1A1A1A] font-bold leading-relaxed">
                      {generatedReview.insights.topPerformingContent}
                    </p>
                  </div>
                )}
                {generatedReview.insights.engagementTrends && (
                  <div className="p-4 rounded-lg bg-[#87CEEB] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <h4 className="font-bold text-sm text-[#1A1A1A]">
                        エンゲージメントトレンド
                      </h4>
                    </div>
                    <p className="text-xs text-[#1A1A1A] font-bold leading-relaxed">
                      {generatedReview.insights.engagementTrends}
                    </p>
                  </div>
                )}
                {generatedReview.insights.audienceBehavior && (
                  <div className="p-4 rounded-lg bg-[#DDA0DD] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center">
                        <Target className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <h4 className="font-bold text-sm text-[#1A1A1A]">
                        オーディエンス行動
                      </h4>
                    </div>
                    <p className="text-xs text-[#1A1A1A] font-bold leading-relaxed">
                      {generatedReview.insights.audienceBehavior}
                    </p>
                  </div>
                )}
                {generatedReview.insights.contentGaps && (
                  <div className="p-4 rounded-lg bg-[#FFDAB9] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <h4 className="font-bold text-sm text-[#1A1A1A]">
                        コンテンツギャップ
                      </h4>
                    </div>
                    <p className="text-xs text-[#1A1A1A] font-bold leading-relaxed">
                      {generatedReview.insights.contentGaps}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations - Action Cards */}
          {generatedReview.recommendations && (
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-[#1A1A1A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">推奨アクション</h3>
              </div>
              <p className="text-xs text-[#6B6B6B] font-bold mb-4">次週に向けた改善提案</p>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Content Strategy */}
                {generatedReview.recommendations.contentStrategy && generatedReview.recommendations.contentStrategy.length > 0 && (
                  <div className="p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#DDA0DD] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
                        <FileText className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#1A1A1A]">コンテンツ戦略</h4>
                        <p className="text-[10px] text-[#6B6B6B] font-bold">{generatedReview.recommendations.contentStrategy.length}件の提案</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {generatedReview.recommendations.contentStrategy.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#1A1A1A] font-bold leading-relaxed">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1A1A1A] flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Posting Schedule */}
                {generatedReview.recommendations.postingSchedule && generatedReview.recommendations.postingSchedule.length > 0 && (
                  <div className="p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#87CEEB] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
                        <Clock className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#1A1A1A]">投稿スケジュール</h4>
                        <p className="text-[10px] text-[#6B6B6B] font-bold">{generatedReview.recommendations.postingSchedule.length}件の提案</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {generatedReview.recommendations.postingSchedule.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#1A1A1A] font-bold leading-relaxed">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1A1A1A] flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Engagement Tactics */}
                {generatedReview.recommendations.engagementTactics && generatedReview.recommendations.engagementTactics.length > 0 && (
                  <div className="p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#A8E6CF] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
                        <Zap className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#1A1A1A]">エンゲージメント戦術</h4>
                        <p className="text-[10px] text-[#6B6B6B] font-bold">{generatedReview.recommendations.engagementTactics.length}件の提案</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {generatedReview.recommendations.engagementTactics.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#1A1A1A] font-bold leading-relaxed">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1A1A1A] flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Platform Optimization */}
                {generatedReview.recommendations.platformOptimization && generatedReview.recommendations.platformOptimization.length > 0 && (
                  <div className="p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all shadow-[4px_4px_0_#1A1A1A]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
                        <Sparkles className="h-4 w-4 text-[#1A1A1A]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#1A1A1A]">プラットフォーム最適化</h4>
                        <p className="text-[10px] text-[#6B6B6B] font-bold">{generatedReview.recommendations.platformOptimization.length}件の提案</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {generatedReview.recommendations.platformOptimization.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#1A1A1A] font-bold leading-relaxed">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1A1A1A] flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!generatedReview && (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-5 shadow-[4px_4px_0_#1A1A1A]">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-lg bg-[#FFF8DC] border-2 border-[#1A1A1A] flex items-center justify-center mb-4 shadow-[2px_2px_0_#1A1A1A]">
              <BarChart3 className="h-6 w-6 text-[#1A1A1A]" />
            </div>
            <p className="text-sm font-bold text-[#1A1A1A] mb-1">
              レビューデータがありません
            </p>
            <p className="text-xs text-[#6B6B6B] font-bold max-w-xs">
              上部の期間選択からレビュー期間を指定し、「レビュー生成」をクリックしてください
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
