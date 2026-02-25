import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc";
import { useI18n } from "../contexts/I18nContext";
import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { PerformanceHeatmap } from "../components/analytics/PerformanceHeatmap";
import { FunnelChart } from "../components/analytics/FunnelChart";
import { TrendChart } from "../components/analytics/TrendChart";
import { ExportButton } from "../components/ExportButton";

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A1A1A] mx-auto"></div>
          <p className="mt-4 text-[#6B6B6B] font-bold">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Prepare export data based on active tab
  const exportData = useMemo(() => {
    if (activeTab === "accounts" && overview?.accountPerformance) {
      return overview.accountPerformance.map((account) => ({
        accountName: account.accountName,
        platform: account.platform,
        totalPosts: account.totalPosts,
        totalViews: account.totalViews,
        totalLikes: account.totalLikes,
        avgEngagementRate: `${account.avgEngagementRate.toFixed(2)}%`,
      }));
    }
    if (activeTab === "top-posts" && topPosts) {
      return topPosts.map((post) => ({
        accountName: post.accountName,
        platform: post.platform,
        content: post.content,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        engagementRate: `${post.engagementRate.toFixed(2)}%`,
      }));
    }
    if (activeTab === "trends" && timeSeries) {
      return timeSeries.map((entry) => ({
        date: entry.date,
        views: entry.views,
        likes: entry.likes,
        comments: entry.comments,
        shares: entry.shares,
        engagementRate: typeof entry.engagementRate === "number"
          ? `${entry.engagementRate.toFixed(2)}%`
          : entry.engagementRate,
      }));
    }
    return [];
  }, [activeTab, overview, topPosts, timeSeries]);

  const exportColumns = useMemo(() => {
    if (activeTab === "accounts") {
      return [
        { header: "アカウント名", dataKey: "accountName" },
        { header: "プラットフォーム", dataKey: "platform" },
        { header: "投稿数", dataKey: "totalPosts" },
        { header: "視聴数", dataKey: "totalViews" },
        { header: "いいね数", dataKey: "totalLikes" },
        { header: "エンゲージメント率", dataKey: "avgEngagementRate" },
      ];
    }
    if (activeTab === "top-posts") {
      return [
        { header: "アカウント名", dataKey: "accountName" },
        { header: "プラットフォーム", dataKey: "platform" },
        { header: "内容", dataKey: "content" },
        { header: "視聴数", dataKey: "views" },
        { header: "いいね数", dataKey: "likes" },
        { header: "コメント数", dataKey: "comments" },
        { header: "シェア数", dataKey: "shares" },
        { header: "エンゲージメント率", dataKey: "engagementRate" },
      ];
    }
    // trends
    return [
      { header: "日付", dataKey: "date" },
      { header: "投稿数", dataKey: "posts" },
      { header: "視聴数", dataKey: "views" },
      { header: "いいね数", dataKey: "likes" },
      { header: "コメント数", dataKey: "comments" },
      { header: "シェア数", dataKey: "shares" },
      { header: "エンゲージメント率", dataKey: "engagementRate" },
    ];
  }, [activeTab]);

  const exportFilename = useMemo(() => {
    const dateStr = new Date().toISOString().split("T")[0];
    const tabSuffix: Record<string, string> = {
      accounts: "accounts",
      "top-posts": "top-posts",
      trends: "trends",
    };
    return `analytics_${tabSuffix[activeTab] || "data"}_${dateStr}`;
  }, [activeTab]);

  const exportTitle = useMemo(() => {
    const titles: Record<string, string> = {
      accounts: "アカウント別パフォーマンス",
      "top-posts": "トップパフォーマンス投稿",
      trends: "トレンドデータ",
    };
    return titles[activeTab] || "アナリティクス";
  }, [activeTab]);

  const tabLabels: Record<string, string> = {
    accounts: "アカウント別",
    "top-posts": "トップ投稿",
    trends: "トレンド",
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header flex items-start justify-between">
        <div>
          <h1 className="page-title font-bold">{t('analytics.title')}</h1>
          <p className="page-subtitle font-bold">
            {t('analytics.subtitle')}
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename={exportFilename}
          columns={exportColumns}
          title={exportTitle}
        />
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="fade-in-up bg-[#FFD700] border-2 border-[#1A1A1A] rounded-lg p-4 shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総投稿数</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{overview?.totalPosts || 0}</p>
            <p className="text-[10px] text-[#6B6B6B] font-bold mt-0.5">過去30日間</p>
          </div>
        </div>

        <div className="fade-in-up bg-[#4ECDC4] border-2 border-[#1A1A1A] rounded-lg p-4 shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総視聴回数</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
              {overview?.totalViews?.toLocaleString() || 0}
            </p>
            <p className="text-[10px] text-[#6B6B6B] font-bold mt-0.5">
              投稿あたり平均{" "}
              {overview?.totalPosts
                ? Math.round(overview.totalViews / overview.totalPosts).toLocaleString()
                : 0}
            </p>
          </div>
        </div>

        <div className="fade-in-up bg-[#A8E6CF] border-2 border-[#1A1A1A] rounded-lg p-4 shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">総いいね数</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
              {overview?.totalLikes?.toLocaleString() || 0}
            </p>
            <p className="text-[10px] text-[#6B6B6B] font-bold mt-0.5">
              投稿あたり平均{" "}
              {overview?.totalPosts
                ? Math.round(overview.totalLikes / overview.totalPosts).toLocaleString()
                : 0}
            </p>
          </div>
        </div>

        <div className="fade-in-up bg-[#FF6B6B] border-2 border-[#1A1A1A] rounded-lg p-4 shadow-[4px_4px_0_#1A1A1A]">
          <div className="pl-3">
            <p className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">エンゲージメント率</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
              {overview?.avgEngagementRate?.toFixed(2) || 0}%
            </p>
            <p className="text-[10px] text-[#6B6B6B] font-bold mt-0.5">平均エンゲージメント率</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg p-1 w-fit shadow-[4px_4px_0_#1A1A1A]">
        {(["accounts", "top-posts", "trends"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border-2 ${
              activeTab === tab
                ? "bg-[#FFD700] text-[#1A1A1A] border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]"
                : "bg-[#FFFDF7] text-[#6B6B6B] border-transparent hover:bg-[#FFF8DC] hover:border-[#1A1A1A]"
            }`}>{tabLabels[tab]}</button>
        ))}
      </div>

      {activeTab === "accounts" && (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
          <h3 className="font-bold text-sm text-[#1A1A1A] mb-1">アカウント別パフォーマンス</h3>
          <p className="text-xs text-[#6B6B6B] font-bold mb-3">各アカウントのエンゲージメント率と投稿数</p>
          {overview?.accountPerformance && overview.accountPerformance.length > 0 ? (
            <div className="space-y-3">
              {overview.accountPerformance.map((account) => (
                <div key={account.accountId} className="flex items-center justify-between p-3 border-2 border-[#1A1A1A] rounded-lg hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-[#FFFDF7]">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-[#1A1A1A]">{account.accountName}</p>
                      <span className="text-[10px] text-[#6B6B6B] font-bold capitalize">
                        {account.platform}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#6B6B6B] font-bold">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5 text-[#1A1A1A]" />
                        {account.totalPosts} 投稿
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-[#1A1A1A]" />
                        {account.totalViews.toLocaleString()} 視聴
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-[#1A1A1A]" />
                        {account.totalLikes.toLocaleString()} いいね
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#1A1A1A]">{account.avgEngagementRate.toFixed(2)}%</p>
                    <p className="text-[10px] text-[#6B6B6B] font-bold">エンゲージメント率</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />
              <p className="text-[#6B6B6B] text-sm font-bold">まだデータがありません</p>
              <p className="text-xs text-[#6B6B6B] font-bold mt-2">
                投稿を開始すると、ここにパフォーマンスデータが表示されます
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "top-posts" && (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
          <h3 className="font-bold text-sm text-[#1A1A1A] mb-1">トップパフォーマンス投稿</h3>
          <p className="text-xs text-[#6B6B6B] font-bold mb-3">エンゲージメント率が最も高い投稿</p>
          {topPosts && topPosts.length > 0 ? (
            <div className="space-y-3">
              {topPosts.map((post, index) => (
                <div key={post.postId} className="flex items-start gap-4 p-3 border-2 border-[#1A1A1A] rounded-lg hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-[#FFFDF7]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] text-[#1A1A1A] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0_#1A1A1A]">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-sm text-[#1A1A1A]">{post.accountName}</p>
                      <span className="text-[10px] text-[#6B6B6B] font-bold capitalize">
                        {post.platform}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6B6B] font-bold line-clamp-2 mb-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[#6B6B6B] font-bold">
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
                      <span className="ml-auto font-bold text-[#1A1A1A]">
                        {post.engagementRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />
              <p className="text-[#6B6B6B] text-sm font-bold">まだデータがありません</p>
              <p className="text-xs text-[#6B6B6B] font-bold mt-2">
                投稿を開始すると、ここにトップパフォーマンス投稿が表示されます
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "trends" && (
        <div className="fade-in-up">
          <TrendChart data={timeSeries || []} isLoading={timeSeriesLoading} />
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
