import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Brain, Activity, Users, BarChart3, TrendingUp } from "lucide-react";

function getConfidenceBadgeVariant(confidence: number): "emerald" | "amber" | "rose" {
  if (confidence >= 70) return "emerald";
  if (confidence >= 40) return "amber";
  return "rose";
}

function getHealthScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
}

function getHealthScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-50";
  if (score >= 40) return "bg-amber-50";
  return "bg-rose-50";
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default function LearningInsights() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  // Unified View data
  const { data: unifiedView, isLoading: unifiedLoading } = trpc.learningInsights.getUnifiedView.useQuery({});

  // Account Health data
  const { data: accountHealth, isLoading: healthLoading } = trpc.learningInsights.getAccountHealth.useQuery({});

  // Confidence History data (only fetch when a specific account is selected)
  const { data: confidenceHistory, isLoading: historyLoading } = trpc.learningInsights.getConfidenceHistory.useQuery(
    { accountId: Number(selectedAccountId) },
    { enabled: selectedAccountId !== "all" }
  );

  if (unifiedLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#5C5CFF] mx-auto" />
          <p className="mt-4 text-[#64748B] text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  const totalLearnings = unifiedView?.stats?.total ?? 0;
  const avgConfidence = unifiedView?.stats?.avgConfidence ?? 0;
  const activeLearnings = unifiedView?.stats?.activeCount ?? 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Page Header */}
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">学習インサイト</h1>
          <p className="page-subtitle">3層学習システムの統合分析ダッシュボード</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#5C5CFF' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#64748B] font-medium uppercase tracking-wide">総学習数</p>
            <p className="text-2xl font-bold text-[#1A1D21] mt-0.5">{totalLearnings}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">全レイヤー合計</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#10B981' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#64748B] font-medium uppercase tracking-wide">平均Confidence</p>
            <p className="text-2xl font-bold text-[#1A1D21] mt-0.5">{avgConfidence.toFixed(1)}%</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">全学習の平均</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#F59E0B' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#64748B] font-medium uppercase tracking-wide">アクティブ学習</p>
            <p className="text-2xl font-bold text-[#1A1D21] mt-0.5">{activeLearnings}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">現在稼働中</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="unified" className="space-y-4">
        <TabsList className="bg-[#F5F5F5]">
          <TabsTrigger value="unified" className="text-xs">統合ビュー</TabsTrigger>
          <TabsTrigger value="health" className="text-xs">アカウントヘルス</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Confidence推移</TabsTrigger>
        </TabsList>

        {/* Tab 1: Unified View */}
        <TabsContent value="unified">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Account Learnings */}
            <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[#5C5CFF]" />
                <h3 className="font-semibold text-sm text-[#1A1D21]">アカウント学習</h3>
              </div>
              {unifiedView?.accountLearnings && unifiedView.accountLearnings.length > 0 ? (
                <div className="space-y-2">
                  {unifiedView.accountLearnings.map((learning, index) => (
                    <div key={index} className="p-2.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F5F5F5] transition-colors">
                      <p className="text-xs text-[#1A1D21] line-clamp-2">
                        {truncateText(learning.content ?? "", 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={getConfidenceBadgeVariant(learning.confidence ?? 0)}>
                          {learning.confidence ?? 0}%
                        </Badge>
                        <span className="text-[10px] text-[#64748B]">
                          使用: {learning.usageCount ?? 0}回
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          成功率: {((learning.successRate ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-[#64748B] mx-auto mb-2" />
                  <p className="text-xs text-[#64748B]">データがありません</p>
                </div>
              )}
            </div>

            {/* Buzz Learnings */}
            <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-[#10B981]" />
                <h3 className="font-semibold text-sm text-[#1A1D21]">バズ学習</h3>
              </div>
              {unifiedView?.buzzLearnings && unifiedView.buzzLearnings.length > 0 ? (
                <div className="space-y-2">
                  {unifiedView.buzzLearnings.map((learning, index) => (
                    <div key={index} className="p-2.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F5F5F5] transition-colors">
                      <p className="text-xs text-[#1A1D21] line-clamp-2">
                        {truncateText(learning.description ?? "", 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={getConfidenceBadgeVariant(learning.confidence ?? 0)}>
                          {learning.confidence ?? 0}%
                        </Badge>
                        <span className="text-[10px] text-[#64748B]">
                          使用: {learning.usageCount ?? 0}回
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          成功率: {((learning.successRate ?? 0)).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-8 w-8 text-[#64748B] mx-auto mb-2" />
                  <p className="text-xs text-[#64748B]">データがありません</p>
                </div>
              )}
            </div>

            {/* Agent Knowledge */}
            <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-[#F59E0B]" />
                <h3 className="font-semibold text-sm text-[#1A1D21]">エージェント知識</h3>
              </div>
              {unifiedView?.agentKnowledge && unifiedView.agentKnowledge.length > 0 ? (
                <div className="space-y-2">
                  {unifiedView.agentKnowledge.map((learning, index) => (
                    <div key={index} className="p-2.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F5F5F5] transition-colors">
                      <p className="text-xs text-[#1A1D21] line-clamp-2">
                        {truncateText(learning.content ?? "", 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={getConfidenceBadgeVariant(learning.confidence ?? 0)}>
                          {learning.confidence ?? 0}%
                        </Badge>
                        <span className="text-[10px] text-[#64748B]">
                          使用: {learning.usageCount ?? 0}回
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          成功率: {((learning.successRate ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 text-[#64748B] mx-auto mb-2" />
                  <p className="text-xs text-[#64748B]">データがありません</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Account Health */}
        <TabsContent value="health">
          <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-[#1A1D21] mb-1">アカウントヘルススコア</h3>
            <p className="text-xs text-[#64748B] mb-4">各アカウントの学習状況とヘルススコア</p>

            {healthLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#5C5CFF]" />
              </div>
            ) : accountHealth && accountHealth.length > 0 ? (
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="grid grid-cols-5 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#64748B] uppercase tracking-wide">
                  <div className="px-3 py-2">アカウント名</div>
                  <div className="px-3 py-2">アクティブ学習</div>
                  <div className="px-3 py-2">平均Confidence</div>
                  <div className="px-3 py-2">平均成功率</div>
                  <div className="px-3 py-2">ヘルススコア</div>
                </div>
                {accountHealth.map((account, index) => (
                  <div key={index} className="grid grid-cols-5 gap-0 border-t border-[#E2E8F0] hover:bg-[#F5F5F5] transition-colors">
                    <div className="px-3 py-2.5 text-sm font-medium text-[#1A1D21]">
                      {account.username}
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1D21]">
                      {account.activeLearningCount ?? 0}
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1D21]">
                      {(account.avgConfidence ?? 0).toFixed(1)}%
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1D21]">
                      {((account.avgSuccessRate ?? 0) * 100).toFixed(1)}%
                    </div>
                    <div className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${getHealthScoreColor(account.healthScore ?? 0)} ${getHealthScoreBg(account.healthScore ?? 0)}`}>
                        {account.healthScore ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-[#64748B] mx-auto mb-4" />
                <p className="text-sm text-[#64748B]">アカウントヘルスデータがありません</p>
                <p className="text-xs text-[#64748B] mt-2">
                  学習データが蓄積されるとヘルススコアが表示されます
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Confidence History */}
        <TabsContent value="history">
          <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-[#1A1D21] mb-1">Confidence推移</h3>
                <p className="text-xs text-[#64748B]">日別のConfidence値と学習数の推移</p>
              </div>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="アカウントを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのアカウント</SelectItem>
                  {accountHealth?.map((account, index) => (
                    <SelectItem key={index} value={String(account.accountId)}>
                      {account.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#5C5CFF]" />
              </div>
            ) : confidenceHistory && confidenceHistory.length > 0 ? (
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#64748B] uppercase tracking-wide">
                  <div className="px-3 py-2">日付</div>
                  <div className="px-3 py-2">平均Confidence</div>
                  <div className="px-3 py-2">学習数</div>
                </div>
                {confidenceHistory.map((entry, index) => (
                  <div key={index} className="grid grid-cols-3 gap-0 border-t border-[#E2E8F0] hover:bg-[#F5F5F5] transition-colors">
                    <div className="px-3 py-2.5 text-sm text-[#1A1D21]">
                      {entry.date}
                    </div>
                    <div className="px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#5C5CFF]"
                            style={{ width: `${entry.avgConfidence ?? 0}%` }}
                          />
                        </div>
                        <span className="text-[#1A1D21] font-medium">
                          {(entry.avgConfidence ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1D21]">
                      {entry.learningCount ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-[#64748B] mx-auto mb-4" />
                <p className="text-sm text-[#64748B]">Confidence履歴データがありません</p>
                <p className="text-xs text-[#64748B] mt-2">
                  学習が進むとConfidence推移が表示されます
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
