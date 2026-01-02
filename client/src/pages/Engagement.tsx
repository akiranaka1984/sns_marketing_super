import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        return <Badge variant="secondary" className="gap-1"><Heart className="h-3 w-3" />いいね</Badge>;
      case "follow":
        return <Badge variant="secondary" className="gap-1"><UserPlus className="h-3 w-3" />フォロー</Badge>;
      case "comment":
        return <Badge variant="secondary" className="gap-1"><MessageCircle className="h-3 w-3" />コメント</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">アクティブ</Badge>;
      case "paused":
        return <Badge variant="outline">一時停止</Badge>;
      case "completed":
        return <Badge variant="secondary">完了</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">自動エンゲージメント</h1>
          <p className="text-muted-foreground">
            自動いいね・フォロー・コメント機能の管理
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>アクティブなタスク</CardTitle>
            <CardDescription>
              {tasksQuery.data?.filter((t: any) => t.status === "active").length || 0}件のタスクが実行中
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasksQuery.isLoading ? (
              <p className="text-center text-muted-foreground py-8">読み込み中...</p>
            ) : tasksQuery.data && tasksQuery.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タイプ</TableHead>
                    <TableHead>アカウント</TableHead>
                    <TableHead>ターゲット</TableHead>
                    <TableHead>実行数/上限</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksQuery.data.map((task: any) => {
                    const account = accountsQuery.data?.find((a) => a.id === task.accountId);
                    return (
                      <TableRow key={task.id}>
                        <TableCell>{getTaskTypeBadge(task.taskType)}</TableCell>
                        <TableCell>{account?.username || `ID: ${task.accountId}`}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          <a href={task.targetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {task.targetUrl}
                          </a>
                        </TableCell>
                        <TableCell>
                          {task.executedCount || 0} / {task.dailyLimit}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                タスクがありません
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>実行ログ</CardTitle>
            <CardDescription>
              最近の{logsQuery.data?.length || 0}件の実行記録
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsQuery.isLoading ? (
              <p className="text-center text-muted-foreground py-8">読み込み中...</p>
            ) : logsQuery.data && logsQuery.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>実行日時</TableHead>
                    <TableHead>タスクID</TableHead>
                    <TableHead>結果</TableHead>
                    <TableHead>詳細</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsQuery.data.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.executedAt).toLocaleString("ja-JP")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.taskId}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge variant="default">成功</Badge>
                        ) : (
                          <Badge variant="destructive">失敗</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {log.result || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                実行ログがありません
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
