import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Play, Pause, Trash2, Heart, UserPlus, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Engagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>();
  const [taskType, setTaskType] = useState<"like" | "follow" | "comment">("like");
  const [targetUrl, setTargetUrl] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");

  // Queries
  const tasksQuery = trpc.engagement.getTasks.useQuery({});
  const logsQuery = trpc.engagement.getLogs.useQuery({ limit: 100 });
  const accountsQuery = trpc.accounts.list.useQuery();

  // Mutations
  const createMutation = trpc.engagement.createTask.useMutation({
    onSuccess: () => {
      toast.success("エンゲージメントタスクを作成しました");
      tasksQuery.refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const pauseMutation = trpc.engagement.updateTask.useMutation({
    onSuccess: () => {
      toast.success("タスクを一時停止しました");
      tasksQuery.refetch();
    },
  });

  const resumeMutation = trpc.engagement.updateTask.useMutation({
    onSuccess: () => {
      toast.success("タスクを再開しました");
      tasksQuery.refetch();
    },
  });

  const deleteMutation = trpc.engagement.deleteTask.useMutation({
    onSuccess: () => {
      toast.success("タスクを削除しました");
      tasksQuery.refetch();
    },
  });

  const resetForm = () => {
    setSelectedAccount(undefined);
    setTaskType("like");
    setTargetUrl("");
    setDailyLimit("50");
  };

  const handleCreate = () => {
    if (!selectedAccount || !targetUrl) {
      toast.error("すべての項目を入力してください");
      return;
    }

    createMutation.mutate({
      projectId: 1, // TODO: Get from context
      accountId: selectedAccount,
      taskType,
      targetUser: targetUrl,
      frequency: parseInt(dailyLimit),
    });
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="h-4 w-4" />;
      case "follow":
        return <UserPlus className="h-4 w-4" />;
      case "comment":
        return <MessageCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTaskTypeBadge = (type: string) => {
    switch (type) {
      case "like":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]"><Heart className="h-3 w-3" />いいね</span>;
      case "follow":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]"><UserPlus className="h-3 w-3" />フォロー</span>;
      case "comment":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]"><MessageCircle className="h-3 w-3" />コメント</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{type}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">アクティブ</span>;
      case "paused":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">一時停止</span>;
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">完了</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{status}</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">自動エンゲージメント</h1>
          <p className="page-subtitle">
            自動いいね・フォロー・コメント機能の管理
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#D4380D] hover:bg-[#B8300B] text-white">
              <Plus className="h-4 w-4 mr-2" />
              新規タスク作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>エンゲージメントタスクを作成</DialogTitle>
              <DialogDescription>
                自動実行するエンゲージメントタスクを設定してください
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="account">アカウント</Label>
                <Select
                  value={selectedAccount?.toString()}
                  onValueChange={(value) => setSelectedAccount(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="アカウントを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data?.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.username} ({account.platform})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskType">タスクタイプ</Label>
                <Select
                  value={taskType}
                  onValueChange={(value: any) => setTaskType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="like">いいね</SelectItem>
                    <SelectItem value="follow">フォロー</SelectItem>
                    <SelectItem value="comment">コメント</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetUrl">ターゲットURL</Label>
                <Input
                  id="targetUrl"
                  placeholder="https://twitter.com/username"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyLimit">1日の実行上限</Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button className="bg-[#D4380D] hover:bg-[#B8300B] text-white" onClick={handleCreate} disabled={createMutation.isPending}>
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 mb-0">
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">アクティブなタスク</h3>
          <p className="text-xs text-[#A3A3A3] mb-3">
            {tasksQuery.data?.filter((t: any) => t.status === "active").length || 0}件のタスクが実行中
          </p>
          {tasksQuery.isLoading ? (
            <p className="text-center text-[#A3A3A3] py-8">読み込み中...</p>
          ) : tasksQuery.data && tasksQuery.data.length > 0 ? (
            <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
              <div className="grid grid-cols-6 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">
                <div className="px-3 py-2">タイプ</div>
                <div className="px-3 py-2">アカウント</div>
                <div className="px-3 py-2">ターゲット</div>
                <div className="px-3 py-2">実行数/上限</div>
                <div className="px-3 py-2">ステータス</div>
                <div className="px-3 py-2">アクション</div>
              </div>
              {tasksQuery.data.map((task: any) => {
                const account = accountsQuery.data?.find((a) => a.id === task.accountId);
                return (
                  <div key={task.id} className="grid grid-cols-6 gap-0 border-t border-[#F0F0F0] hover:bg-[#F5F5F5] transition-colors">
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">{getTaskTypeBadge(task.taskType)}</div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">{account?.username || `ID: ${task.accountId}`}</div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A] max-w-xs truncate">
                      <a href={task.targetUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4380D] hover:underline">
                        {task.targetUrl}
                      </a>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      {task.executedCount || 0} / {task.dailyLimit}
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">{getStatusBadge(task.status)}</div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        {task.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pauseMutation.mutate({ id: task.id, isActive: false })}
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            一時停止
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resumeMutation.mutate({ id: task.id, isActive: true })}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            再開
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate({ id: task.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-[#A3A3A3] py-8">
              タスクがありません
            </p>
          )}
        </div>

        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">実行ログ</h3>
          <p className="text-xs text-[#A3A3A3] mb-3">
            最近の{logsQuery.data?.length || 0}件の実行記録
          </p>
          {logsQuery.isLoading ? (
            <p className="text-center text-[#A3A3A3] py-8">読み込み中...</p>
          ) : logsQuery.data && logsQuery.data.length > 0 ? (
            <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
              <div className="grid grid-cols-4 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">
                <div className="px-3 py-2">実行日時</div>
                <div className="px-3 py-2">タスクID</div>
                <div className="px-3 py-2">結果</div>
                <div className="px-3 py-2">詳細</div>
              </div>
              {logsQuery.data.map((log: any) => (
                <div key={log.id} className="grid grid-cols-4 gap-0 border-t border-[#F0F0F0] hover:bg-[#F5F5F5] transition-colors">
                  <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                    {new Date(log.executedAt).toLocaleString("ja-JP")}
                  </div>
                  <div className="px-3 py-2.5 text-xs text-[#1A1A1A] font-mono">{log.taskId}</div>
                  <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                    {log.success ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">成功</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700">失敗</span>
                    )}
                  </div>
                  <div className="px-3 py-2.5 text-xs text-[#A3A3A3] max-w-xs truncate">
                    {log.result || "-"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[#A3A3A3] py-8">
              実行ログがありません
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
