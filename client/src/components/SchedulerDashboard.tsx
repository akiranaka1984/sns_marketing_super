import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Pause, Heart, MessageCircle, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface SchedulerDashboardProps {
  projectId?: number;
}

export default function SchedulerDashboard({ projectId }: SchedulerDashboardProps) {
  const { data: status, refetch: refetchStatus } = trpc.scheduler.getStatus.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.scheduler.getStats.useQuery({ projectId });

  const startMutation = trpc.scheduler.start.useMutation();
  const stopMutation = trpc.scheduler.stop.useMutation();

  const handleStart = async () => {
    await startMutation.mutateAsync();
    toast.success("スケジューラーを開始しました");
    refetchStatus();
  };

  const handleStop = async () => {
    await stopMutation.mutateAsync();
    toast.success("スケジューラーを停止しました");
    refetchStatus();
  };

  const handleRefresh = () => {
    refetchStatus();
    refetchStats();
  };

  return (
    <div className="space-y-6">
      {/* スケジューラー状態 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">自動実行スケジューラー</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {status?.isRunning ? (
              <Button variant="destructive" size="sm" onClick={handleStop}>
                <Pause className="w-4 h-4 mr-2" />
                停止
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleStart}>
                <Play className="w-4 h-4 mr-2" />
                開始
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                status?.isRunning ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span>{status?.isRunning ? "実行中" : "停止中"}</span>
          </div>
        </CardContent>
      </Card>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-sm text-gray-500">待機中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.processing || 0}</div>
            <p className="text-sm text-gray-500">実行中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats?.completedToday || 0}</div>
            <p className="text-sm text-gray-500">今日の成功</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats?.failedToday || 0}</div>
            <p className="text-sm text-gray-500">今日の失敗</p>
          </CardContent>
        </Card>
      </div>

      {/* 次の実行予定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">次の実行予定</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.upcomingTasks?.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {task.type === "like" ? (
                    <Heart className="w-4 h-4 text-red-500" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                  )}
                  <span className="text-sm truncate max-w-md">{task.postUrl}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  {task.scheduledAt ? new Date(task.scheduledAt).toLocaleString() : "-"}
                </div>
              </div>
            ))}
            {(!stats?.upcomingTasks || stats.upcomingTasks.length === 0) && (
              <p className="text-center text-gray-500 py-4">予定されているタスクはありません</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最近の実行履歴 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">最近の実行履歴（24時間）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.recentHistory?.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {task.type === "like" ? (
                    <Heart className="w-4 h-4 text-red-500" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                  )}
                  <span className="text-sm truncate max-w-md">{task.postUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  {task.status === "completed" ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      成功
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">
                      <XCircle className="w-3 h-3 mr-1" />
                      失敗
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {task.executedAt ? new Date(task.executedAt).toLocaleString() : "-"}
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.recentHistory || stats.recentHistory.length === 0) && (
              <p className="text-center text-gray-500 py-4">実行履歴がありません</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
