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
  if (score >= 70) return "text-[#1A1A1A]";
  if (score >= 40) return "text-[#1A1A1A]";
  return "text-[#1A1A1A]";
}

function getHealthScoreBg(score: number): string {
  if (score >= 70) return "bg-[#A8E6CF]";
  if (score >= 40) return "bg-[#FFD700]";
  return "bg-[#FF6B6B]";
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
          <Loader2 className="h-8 w-8 animate-spin text-[#FFD700] mx-auto" />
          <p className="mt-4 text-[#6B6B6B] text-sm font-bold">読み込み中...</p>
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
        <div className="fade-in-up bg-[#4ECDC4] p-4 border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総学習数</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{totalLearnings}</p>
            <p className="text-[10px] text-[#1A1A1A] mt-0.5 font-bold">全レイヤー合計</p>
          </div>
        </div>
        <div className="fade-in-up bg-[#A8E6CF] p-4 border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">平均Confidence</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{avgConfidence.toFixed(1)}%</p>
            <p className="text-[10px] text-[#1A1A1A] mt-0.5 font-bold">全学習の平均</p>
          </div>
        </div>
        <div className="fade-in-up bg-[#FFD700] p-4 border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">アクティブ学習</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{activeLearnings}</p>
            <p className="text-[10px] text-[#1A1A1A] mt-0.5 font-bold">現在稼働中</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="unified" className="space-y-4">
        <TabsList className="bg-[#FFFDF7] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
          <TabsTrigger value="unified" className="text-xs font-bold">統合ビュー</TabsTrigger>
          <TabsTrigger value="health" className="text-xs font-bold">アカウントヘルス</TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-bold">Confidence推移</TabsTrigger>
        </TabsList>

        {/* Tab 1: Unified View */}
        <TabsContent value="unified">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Account Learnings */}
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[#1A1A1A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">アカウント学習</h3>
              </div>
              {unifiedView?.accountLearnings && unifiedView.accountLearnings.length > 0 ? (
                <div className="space-y-2">
                  {unifiedView.accountLearnings.map((learning, index) => (
                    <div key={index} className="p-2.5 border-2 border-[#1A1A1A] rounded-lg hover:bg-[#FFF8DC] transition-colors bg-white">
                      <p className="text-xs text-[#1A1A1A] line-clamp-2 font-bold">
                        {truncateText(learning.content ?? "", 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={getConfidenceBadgeVariant(learning.confidence ?? 0)}>
                          {learning.confidence ?? 0}%
                        </Badge>
                        <span className="text-[10px] text-[#6B6B6B] font-bold">
                          使用: {learning.usageCount ?? 0}回
                        </span>
                        <span className="text-[10px] text-[#6B6B6B] font-bold">
                          成功率: {((learning.successRate ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-[#6B6B6B] mx-auto mb-2" />
                  <p className="text-xs text-[#6B6B6B] font-bold">データがありません</p>
                </div>
              )}
            </div>

            {/* Buzz Learnings */}
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">バズ学習</h3>
              </div>
              {unifiedView?.buzzLearnings && unifiedView.buzzLearnings.length > 0 ? (
                <div className="space-y-2">
                  {unifiedView.buzzLearnings.map((learning, index) => (
                    <div key={index} className="p-2.5 border-2 border-[#1A1A1A] rounded-lg hover:bg-[#FFF8DC] transition-colors bg-white">
                      <p className="text-xs text-[#1A1A1A] line-clamp-2 font-bold">
                        {truncateText(learning.description ?? "", 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={getConfidenceBadgeVariant(learning.confidence ?? 0)}>
                          {learning.confidence ?? 0}%
                        </Badge>
                        <span className="text-[10px] text-[#6B6B6B] font-bold">
                          使用: {learning.usageCount ?? 0}回
                        </span>
                        <span className="text-[10px] text-[#6B6B6B] font-bold">
                          成功率: {((learning.successRate ?? 0)).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-8 w-8 text-[#6B6B6B] mx-auto mb-2" />
                  <p className="text-xs text-[#6B6B6B] font-bold">データがありません</p>
                </div>
              )}
            </div>

            {/* Agent Knowledge */}
            <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-[#1A1A1A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">エージェント知識</h3>
              </div>
              {unifiedView?.agentKnowledge && unifiedView.agentKnowledge.length > 0 ? (
                <div className="space-y-2">
                  {unifiedView.agentKnowledge.map((learning, index) => (
                    <div key={index} className="p-2.5 border-2 border-[#1A1A1A] rounded-lg hover:bg-[#FFF8DC] transition-colors bg-white">
                      <p className="text-xs text-[#1A1A1A] line-clamp-2 font-bold">
                        {truncateText(learning.content ?? "", 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={getConfidenceBadgeVariant(learning.confidence ?? 0)}>
                          {learning.confidence ?? 0}%
                        </Badge>
                        <span className="text-[10px] text-[#6B6B6B] font-bold">
                          使用: {learning.usageCount ?? 0}回
                        </span>
                        <span className="text-[10px] text-[#6B6B6B] font-bold">
                          成功率: {((learning.successRate ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 text-[#6B6B6B] mx-auto mb-2" />
                  <p className="text-xs text-[#6B6B6B] font-bold">データがありません</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Account Health */}
        <TabsContent value="health">
          <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
            <h3 className="font-bold text-sm text-[#1A1A1A] mb-1">アカウントヘルススコア</h3>
            <p className="text-xs text-[#6B6B6B] mb-4 font-bold">各アカウントの学習状況とヘルススコア</p>

            {healthLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
              </div>
            ) : accountHealth && accountHealth.length > 0 ? (
              <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[2px_2px_0_#1A1A1A]">
                <div className="grid grid-cols-5 gap-0 bg-[#FFD700] text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wide border-b-2 border-[#1A1A1A]">
                  <div className="px-3 py-2">アカウント名</div>
                  <div className="px-3 py-2">アクティブ学習</div>
                  <div className="px-3 py-2">平均Confidence</div>
                  <div className="px-3 py-2">平均成功率</div>
                  <div className="px-3 py-2">ヘルススコア</div>
                </div>
                {accountHealth.map((account, index) => (
                  <div key={index} className="grid grid-cols-5 gap-0 border-b-2 border-[#1A1A1A] last:border-b-0 hover:bg-[#FFF8DC] transition-colors bg-white">
                    <div className="px-3 py-2.5 text-sm font-bold text-[#1A1A1A]">
                      {account.username}
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1A1A] font-bold">
                      {account.activeLearningCount ?? 0}
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1A1A] font-bold">
                      {(account.avgConfidence ?? 0).toFixed(1)}%
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1A1A] font-bold">
                      {((account.avgSuccessRate ?? 0) * 100).toFixed(1)}%
                    </div>
                    <div className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ${getHealthScoreColor(account.healthScore ?? 0)} ${getHealthScoreBg(account.healthScore ?? 0)} border-2 border-[#1A1A1A]`}>
                        {account.healthScore ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />
                <p className="text-sm text-[#6B6B6B] font-bold">アカウントヘルスデータがありません</p>
                <p className="text-xs text-[#6B6B6B] mt-2 font-bold">
                  学習データが蓄積されるとヘルススコアが表示されます
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Confidence History */}
        <TabsContent value="history">
          <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#1A1A1A] mb-1">Confidence推移</h3>
                <p className="text-xs text-[#6B6B6B] font-bold">日別のConfidence値と学習数の推移</p>
              </div>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-48 border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
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
                <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
              </div>
            ) : confidenceHistory && confidenceHistory.length > 0 ? (
              <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[2px_2px_0_#1A1A1A]">
                <div className="grid grid-cols-3 gap-0 bg-[#FFD700] text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wide border-b-2 border-[#1A1A1A]">
                  <div className="px-3 py-2">日付</div>
                  <div className="px-3 py-2">平均Confidence</div>
                  <div className="px-3 py-2">学習数</div>
                </div>
                {confidenceHistory.map((entry, index) => (
                  <div key={index} className="grid grid-cols-3 gap-0 border-b-2 border-[#1A1A1A] last:border-b-0 hover:bg-[#FFF8DC] transition-colors bg-white">
                    <div className="px-3 py-2.5 text-sm text-[#1A1A1A] font-bold">
                      {entry.date}
                    </div>
                    <div className="px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#FFFDF7] rounded-full overflow-hidden border-2 border-[#1A1A1A]">
                          <div
                            className="h-full rounded-full bg-[#FFD700]"
                            style={{ width: `${entry.avgConfidence ?? 0}%` }}
                          />
                        </div>
                        <span className="text-[#1A1A1A] font-bold">
                          {(entry.avgConfidence ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-sm text-[#1A1A1A] font-bold">
                      {entry.learningCount ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />
                <p className="text-sm text-[#6B6B6B] font-bold">Confidence履歴データがありません</p>
                <p className="text-xs text-[#6B6B6B] mt-2 font-bold">
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
