import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useI18n } from "../contexts/I18nContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

export function Analytics() {
  const { t } = useI18n();
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

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('analytics.subtitle')}
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総投稿数</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.totalPosts || 0}</div>
              <p className="text-xs text-muted-foreground">過去30日間</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総視聴回数</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.totalViews?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                投稿あたり平均{" "}
                {overview?.totalPosts
                  ? Math.round(overview.totalViews / overview.totalPosts).toLocaleString()
                  : 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総いいね数</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.totalLikes?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                投稿あたり平均{" "}
                {overview?.totalPosts
                  ? Math.round(overview.totalLikes / overview.totalPosts).toLocaleString()
                  : 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">エンゲージメント率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.avgEngagementRate?.toFixed(2) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">平均エンゲージメント率</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="accounts">アカウント別</TabsTrigger>
            <TabsTrigger value="top-posts">トップ投稿</TabsTrigger>
            <TabsTrigger value="trends">トレンド</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>アカウント別パフォーマンス</CardTitle>
                <CardDescription>各アカウントのエンゲージメント率と投稿数</CardDescription>
              </CardHeader>
              <CardContent>
                {overview?.accountPerformance && overview.accountPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {overview.accountPerformance.map((account) => (
                      <div key={account.accountId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account.accountName}</p>
                            <span className="text-xs text-muted-foreground capitalize">
                              {account.platform}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BarChart3 className="h-4 w-4" />
                              {account.totalPosts} 投稿
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {account.totalViews.toLocaleString()} 視聴
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              {account.totalLikes.toLocaleString()} いいね
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{account.avgEngagementRate.toFixed(2)}%</p>
                          <p className="text-xs text-muted-foreground">エンゲージメント率</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">まだデータがありません</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      投稿を開始すると、ここにパフォーマンスデータが表示されます
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-posts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>トップパフォーマンス投稿</CardTitle>
                <CardDescription>エンゲージメント率が最も高い投稿</CardDescription>
              </CardHeader>
              <CardContent>
                {topPosts && topPosts.length > 0 ? (
                  <div className="space-y-4">
                    {topPosts.map((post, index) => (
                      <div key={post.postId} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{post.accountName}</p>
                            <span className="text-xs text-muted-foreground capitalize">
                              {post.platform}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {post.views.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              {post.likes.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" />
                              {post.comments.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="h-4 w-4" />
                              {post.shares.toLocaleString()}
                            </span>
                            <span className="ml-auto font-bold text-primary">
                              {post.engagementRate.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">まだデータがありません</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      投稿を開始すると、ここにトップパフォーマンス投稿が表示されます
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>パフォーマンストレンド</CardTitle>
                <CardDescription>時系列でのエンゲージメント推移</CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeries && timeSeries.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-center py-12">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">チャート機能は近日公開予定</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {timeSeries.length}日分のデータが利用可能です
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">まだデータがありません</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      投稿を開始すると、ここにトレンドデータが表示されます
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
