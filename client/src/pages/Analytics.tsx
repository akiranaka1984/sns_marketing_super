import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useI18n } from "../contexts/I18nContext";
import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { PerformanceHeatmap } from "../components/analytics/PerformanceHeatmap";
import { FunnelChart } from "../components/analytics/FunnelChart";

export function Analytics() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("accounts");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const { data: overview, isLoading: overviewLoading, error: overviewError } = trpc.analytics.getOverview.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: timeSeries, isLoading: timeSeriesLoading, error: timeSeriesError } = trpc.analytics.getTimeSeries.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    interval: "day",
  });

  const { data: topPosts, isLoading: topPostsLoading, error: topPostsError } = trpc.analytics.getTopPosts.useQuery({
    limit: 10,
    sortBy: "engagement",
  });

  const { data: heatmapData, isLoading: heatmapLoading } = trpc.analytics.getHeatmapData.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: funnelData, isLoading: funnelLoading } = trpc.analytics.getFunnelData.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-[#94A3B8]">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const tabLabels: Record<string, string> = {
    accounts: "アカウント別",
    "top-posts": "トップ投稿",
    trends: "トレンド",
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">{t('analytics.title')}</h1>
          <p className="page-subtitle">
            {t('analytics.subtitle')}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#06B6D4' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wide">総投稿数</p>
            <p className="text-2xl font-bold text-[#1E293B] mt-0.5">{overview?.totalPosts || 0}</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">過去30日間</p>
          </div>
        </div>

        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#2563EB' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wide">総視聴回数</p>
            <p className="text-2xl font-bold text-[#1E293B] mt-0.5">
              {overview?.totalViews?.toLocaleString() || 0}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">
              投稿あたり平均{" "}
              {overview?.totalPosts
                ? Math.round(overview.totalViews / overview.totalPosts).toLocaleString()
                : 0}
            </p>
          </div>
        </div>

        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#10B981' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wide">総いいね数</p>
            <p className="text-2xl font-bold text-[#1E293B] mt-0.5">
              {overview?.totalLikes?.toLocaleString() || 0}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">
              投稿あたり平均{" "}
              {overview?.totalPosts
                ? Math.round(overview.totalLikes / overview.totalPosts).toLocaleString()
                : 0}
            </p>
          </div>
        </div>

        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#F59E0B' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wide">エンゲージメント率</p>
            <p className="text-2xl font-bold text-[#1E293B] mt-0.5">
              {overview?.avgEngagementRate?.toFixed(2) || 0}%
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">平均エンゲージメント率</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-0.5 w-fit">
        {(["accounts", "top-posts", "trends"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab ? "bg-white text-[#1E293B] shadow-sm" : "text-[#94A3B8] hover:text-[#64748B]"
            }`}>{tabLabels[tab]}</button>
        ))}
      </div>

      {activeTab === "accounts" && (
        <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
          <h3 className="font-semibold text-sm text-[#1E293B] mb-1">アカウント別パフォーマンス</h3>
          <p className="text-xs text-[#94A3B8] mb-3">各アカウントのエンゲージメント率と投稿数</p>
          {overview?.accountPerformance && overview.accountPerformance.length > 0 ? (
            <div className="space-y-3">
              {overview.accountPerformance.map((account) => (
                <div key={account.accountId} className="flex items-center justify-between p-3 border border-[#E2E8F0] rounded-xl hover:shadow-md transition-all">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-[#1E293B]">{account.accountName}</p>
                      <span className="text-[10px] text-[#94A3B8] capitalize">
                        {account.platform}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5 text-cyan-500" />
                        {account.totalPosts} 投稿
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-cyan-500" />
                        {account.totalViews.toLocaleString()} 視聴
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-cyan-500" />
                        {account.totalLikes.toLocaleString()} いいね
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-cyan-600">{account.avgEngagementRate.toFixed(2)}%</p>
                    <p className="text-[10px] text-[#94A3B8]">エンゲージメント率</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#94A3B8] text-sm">まだデータがありません</p>
              <p className="text-xs text-[#94A3B8] mt-2">
                投稿を開始すると、ここにパフォーマンスデータが表示されます
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "top-posts" && (
        <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
          <h3 className="font-semibold text-sm text-[#1E293B] mb-1">トップパフォーマンス投稿</h3>
          <p className="text-xs text-[#94A3B8] mb-3">エンゲージメント率が最も高い投稿</p>
          {topPosts && topPosts.length > 0 ? (
            <div className="space-y-3">
              {topPosts.map((post, index) => (
                <div key={post.postId} className="flex items-start gap-4 p-3 border border-[#E2E8F0] rounded-xl hover:shadow-md transition-all">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-sm text-[#1E293B]">{post.accountName}</p>
                      <span className="text-[10px] text-[#94A3B8] capitalize">
                        {post.platform}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] line-clamp-2 mb-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {post.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" />
                        {post.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {post.comments.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="h-3.5 w-3.5" />
                        {post.shares.toLocaleString()}
                      </span>
                      <span className="ml-auto font-bold text-cyan-600">
                        {post.engagementRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#94A3B8] text-sm">まだデータがありません</p>
              <p className="text-xs text-[#94A3B8] mt-2">
                投稿を開始すると、ここにトップパフォーマンス投稿が表示されます
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "trends" && (
        <div className="fade-in-up bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
          <h3 className="font-semibold text-sm text-[#1E293B] mb-1">パフォーマンストレンド</h3>
          <p className="text-xs text-[#94A3B8] mb-3">時系列でのエンゲージメント推移</p>
          {timeSeries && timeSeries.length > 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#94A3B8] text-sm">チャート機能は近日公開予定</p>
              <p className="text-xs text-[#94A3B8] mt-2">
                {timeSeries.length}日分のデータが利用可能です
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#94A3B8] text-sm">まだデータがありません</p>
              <p className="text-xs text-[#94A3B8] mt-2">
                投稿を開始すると、ここにトレンドデータが表示されます
              </p>
            </div>
          )}
        </div>
      )}

      {/* Performance Heatmap */}
      <div className="fade-in-up">
        <PerformanceHeatmap
          data={heatmapData?.cells ?? []}
          isLoading={heatmapLoading}
        />
      </div>

      {/* Conversion Funnel */}
      <div className="fade-in-up">
        <FunnelChart
          stages={funnelData?.stages ?? []}
          isLoading={funnelLoading}
        />
      </div>
    </div>
  );
}
