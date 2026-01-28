import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Pause, Heart, MessageCircle, Clock, CheckCircle, XCircle, RefreshCw, Repeat2, UserPlus, Bot, FileText, ChevronDown, ChevronUp, User, Palette, BookOpen } from "lucide-react";
import { useState } from "react";

interface SchedulerDashboardProps {
  projectId?: number;
}

export default function SchedulerDashboard({ projectId }: SchedulerDashboardProps) {
  const { data: status, refetch: refetchStatus } = trpc.scheduler.getStatus.useQuery();
  const { data: stats, refetch: refetchStats } = trpc.scheduler.getStats.useQuery({ projectId });
  const { data: agentSchedulerStatus, refetch: refetchAgentScheduler } = trpc.agentScheduler.status.useQuery();

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
    refetchAgentScheduler();
  };

  // Filter agent scheduled executions by projectId if provided
  const filteredAgentExecutions = projectId
    ? agentSchedulerStatus?.scheduledExecutions?.filter((exec: any) => {
        // We need to check if the agent belongs to this project
        // For now, show all - the backend should filter by project
        return true;
      })
    : agentSchedulerStatus?.scheduledExecutions;

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
            <span className="text-slate-700">{status?.isRunning ? "実行中" : "停止中"}</span>
          </div>
        </CardContent>
      </Card>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">{stats?.pending || 0}</div>
            <p className="text-sm text-slate-500">待機中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">{stats?.processing || 0}</div>
            <p className="text-sm text-slate-500">実行中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats?.completedToday || 0}</div>
            <p className="text-sm text-slate-500">今日の成功</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats?.failedToday || 0}</div>
            <p className="text-sm text-slate-500">今日の失敗</p>
          </CardContent>
        </Card>
      </div>

      {/* エージェント自動投稿の実行予定 */}
      <AgentExecutionList
        executions={filteredAgentExecutions}
        agentSchedulerStatus={agentSchedulerStatus}
      />

      {/* インタラクションの実行予定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            インタラクションの実行予定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.upcomingTasks?.map((task: any) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {task.type === "like" && <Heart className="w-4 h-4 text-red-500" />}
                  {task.type === "comment" && <MessageCircle className="w-4 h-4 text-blue-500" />}
                  {task.type === "retweet" && <Repeat2 className="w-4 h-4 text-green-500" />}
                  {task.type === "follow" && <UserPlus className="w-4 h-4 text-purple-500" />}
                  <span className="text-sm truncate max-w-md text-slate-700">{task.postUrl}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  {task.scheduledAt ? new Date(task.scheduledAt).toLocaleString() : "-"}
                </div>
              </div>
            ))}
            {(!stats?.upcomingTasks || stats.upcomingTasks.length === 0) && (
              <p className="text-center text-slate-500 py-4">インタラクションの予定がありません</p>
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
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {task.type === "like" && <Heart className="w-4 h-4 text-red-500" />}
                  {task.type === "comment" && <MessageCircle className="w-4 h-4 text-blue-500" />}
                  {task.type === "retweet" && <Repeat2 className="w-4 h-4 text-green-500" />}
                  {task.type === "follow" && <UserPlus className="w-4 h-4 text-purple-500" />}
                  <span className="text-sm truncate max-w-md text-slate-700">{task.postUrl}</span>
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
                  <span className="text-xs text-slate-500">
                    {task.executedAt ? new Date(task.executedAt).toLocaleString() : "-"}
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.recentHistory || stats.recentHistory.length === 0) && (
              <p className="text-center text-slate-500 py-4">実行履歴がありません</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Tone labels in Japanese
const toneLabels: Record<string, string> = {
  formal: "フォーマル",
  casual: "カジュアル",
  friendly: "フレンドリー",
  professional: "プロフェッショナル",
  humorous: "ユーモラス",
};

// Style labels in Japanese
const styleLabels: Record<string, string> = {
  ranking: "ランキング",
  trivia: "豆知識",
  story: "ストーリー",
  tutorial: "チュートリアル",
  news: "ニュース",
  review: "レビュー",
};

// Agent Execution List component with toggle functionality
function AgentExecutionList({
  executions,
  agentSchedulerStatus,
}: {
  executions: any[] | undefined;
  agentSchedulerStatus: any;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-500" />
          自動投稿の実行予定
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {executions && executions.length > 0 ? (
            executions.slice(0, 5).map((exec: any, index: number) => (
              <div key={`agent-${exec.agentId}-${exec.accountId}-${index}`}>
                <div
                  onClick={() => toggleExpand(index)}
                  className="flex items-center justify-between p-3 bg-violet-50 rounded-lg cursor-pointer hover:bg-violet-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-violet-500" />
                    <div>
                      <span className="text-sm font-medium text-slate-700">{exec.agentName}</span>
                      <span className="text-xs text-slate-500 ml-2">({exec.platform})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    {exec.scheduledTime ? new Date(exec.scheduledTime).toLocaleString('ja-JP') : "-"}
                    {expandedIndex === index ? (
                      <ChevronUp className="w-4 h-4 ml-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-2" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expandedIndex === index && (
                  <div className="mt-2 ml-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Account info */}
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        アカウント: <span className="font-medium">{exec.accountUsername}</span>
                      </span>
                    </div>

                    {/* Theme */}
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm text-slate-600">テーマ:</span>
                        <p className="text-sm text-slate-800 mt-1">{exec.agentTheme}</p>
                      </div>
                    </div>

                    {/* Tone and Style */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          トーン: <Badge variant="secondary" className="ml-1">{toneLabels[exec.agentTone] || exec.agentTone}</Badge>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          スタイル: <Badge variant="secondary" className="ml-1">{styleLabels[exec.agentStyle] || exec.agentStyle}</Badge>
                        </span>
                      </div>
                    </div>

                    {/* Scheduled post content */}
                    {exec.scheduledPostContent && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">予定されている投稿内容:</p>
                        <p className="text-sm text-slate-700 bg-white p-3 rounded border border-slate-100 line-clamp-3">
                          {exec.scheduledPostContent}
                        </p>
                      </div>
                    )}

                    {/* Recent post example (fallback) */}
                    {!exec.scheduledPostContent && exec.recentPostContent && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">最近の投稿例:</p>
                        <p className="text-sm text-slate-700 bg-white p-3 rounded border border-slate-100 line-clamp-3">
                          {exec.recentPostContent}
                        </p>
                      </div>
                    )}

                    {!exec.scheduledPostContent && !exec.recentPostContent && (
                      <p className="text-xs text-slate-400 italic">
                        ※ AIがテーマに基づいて投稿内容を自動生成します
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-slate-500 py-4">
              自動投稿の予定がありません
              <br />
              <span className="text-xs">エージェントをプロジェクトに紐づけ、投稿時間を設定してください</span>
            </p>
          )}
        </div>
        {agentSchedulerStatus && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <div
              className={`w-2 h-2 rounded-full ${
                agentSchedulerStatus.running ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span>エージェントスケジューラー: {agentSchedulerStatus.running ? "実行中" : "停止中"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
