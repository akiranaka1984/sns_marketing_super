import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Activity,
  Calendar,
  Heart,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function Automation() {
  // Get statistics
  const freezeStats = trpc.freeze.getStats.useQuery({ days: 30 });
  const scheduledStats = trpc.scheduledPosts.getStats.useQuery({ days: 30 });
  const engagementStats = trpc.engagement.getStats.useQuery({ days: 30 });

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">自動化管理</h1>
        <p className="text-muted-foreground">
          凍結検知、スケジュール投稿、自動エンゲージメントの統合管理
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {/* Freeze Detection */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">凍結検知</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {freezeStats.data?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">過去30日間</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                解決率: {freezeStats.data?.resolveRate || 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">スケジュール投稿</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scheduledStats.data?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">過去30日間</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                成功率: {scheduledStats.data?.successRate || 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Auto Engagement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自動エンゲージメント</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {engagementStats.data?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">過去30日間</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className="text-green-600">
                成功率: {engagementStats.data?.successRate || 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Freeze Detection Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle>凍結検知・自動対応</CardTitle>
            </div>
            <CardDescription>
              アカウント凍結を自動検知し、即座に対応
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">IPブロック</span>
                <span className="font-medium">
                  {freezeStats.data?.byType.ip_block || 0}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">デバイスブロック</span>
                <span className="font-medium">
                  {freezeStats.data?.byType.device_block || 0}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">アカウント凍結</span>
                <span className="font-medium">
                  {freezeStats.data?.byType.account_freeze || 0}件
                </span>
              </div>
            </div>
            <Link href="/freeze-detection">
              <Button className="w-full">詳細を見る</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Scheduled Posts Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <CardTitle>スケジュール投稿</CardTitle>
            </div>
            <CardDescription>
              指定した日時に自動的に投稿を実行
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">待機中</span>
                <span className="font-medium">
                  {scheduledStats.data?.byStatus.pending || 0}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">投稿済み</span>
                <span className="font-medium text-green-600">
                  {scheduledStats.data?.byStatus.posted || 0}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">失敗</span>
                <span className="font-medium text-red-600">
                  {scheduledStats.data?.byStatus.failed || 0}件
                </span>
              </div>
            </div>
            <Link href="/scheduled-posts">
              <Button className="w-full">詳細を見る</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Auto Engagement Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              <CardTitle>自動エンゲージメント</CardTitle>
            </div>
            <CardDescription>
              いいね、フォロー、コメントを自動実行
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">いいね</span>
                <span className="font-medium">
                  {engagementStats.data?.byType.like || 0}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">フォロー</span>
                <span className="font-medium">
                  {engagementStats.data?.byType.follow || 0}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">コメント</span>
                <span className="font-medium">
                  {engagementStats.data?.byType.comment || 0}件
                </span>
              </div>
            </div>
            <Link href="/engagement">
              <Button className="w-full">詳細を見る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            システムステータス
          </CardTitle>
          <CardDescription>自動化システムの稼働状況</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">凍結検知システム</p>
                <p className="text-xs text-muted-foreground">稼働中</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">投稿スケジューラー</p>
                <p className="text-xs text-muted-foreground">稼働中（1分ごと）</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">エンゲージメント実行</p>
                <p className="text-xs text-muted-foreground">稼働中（5分ごと）</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
