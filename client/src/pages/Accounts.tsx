import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, RefreshCw, ExternalLink, Power, PowerOff, RotateCw, ArrowUpDown, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";

type Platform = "all" | "twitter" | "facebook" | "instagram" | "tiktok";
type SortField = "username" | "status" | "createdAt";
type SortOrder = "asc" | "desc";

export default function Accounts() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [assigningAccountId, setAssigningAccountId] = useState<number | null>(null);
  const [deviceSelectDialogOpen, setDeviceSelectDialogOpen] = useState(false);
  const [selectedAccountForDevice, setSelectedAccountForDevice] = useState<{id: number, username: string} | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Fetch available devices from DuoPlus
  const { data: duoplusDevices, isLoading: isLoadingDevices } = trpc.device.listDuoPlusDevices.useQuery(undefined, {
    enabled: deviceSelectDialogOpen,
  });
  
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery(undefined, {
    refetchInterval: 60000, // Refetch every 60 seconds
  });
  
  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => {
      toast.success("アカウントを削除しました");
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`削除失敗: ${error.message}`);
    },
  });

  const registerMutation = trpc.accounts.register.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("アカウント登録成功");
      } else {
        toast.error(`登録失敗: ${result.error}`);
      }
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`登録失敗: ${error.message}`);
    },
  });

  const syncDeviceIdsMutation = trpc.accounts.syncDeviceIds.useMutation({
    onSuccess: (result) => {
      // 同期成功したアカウント数を計算
      const successCount = result.synced || 0;
      const errorCount = result.errors?.length || 0;
      
      if (successCount > 0 && errorCount === 0) {
        toast.success(result.message);
      } else if (successCount > 0 && errorCount > 0) {
        toast.success(`${successCount}件のアカウントを同期しました`);
        // デバイス未設定のアカウントは警告として表示
        toast.warning(`${errorCount}件のアカウントはデバイス未設定のためスキップされました`, {
          description: 'アカウントを登録してデバイスを割り当ててください',
        });
      } else if (errorCount > 0) {
        toast.warning(`同期対象のアカウントがありません`, {
          description: `${errorCount}件のアカウントはデバイス未設定です`,
        });
      } else {
        toast.info('同期対象のアカウントがありません');
      }
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`同期失敗: ${error.message}`);
    },
  });

  const activateMutation = trpc.accounts.activate.useMutation({
    onSuccess: () => {
      toast.success("アカウントをアクティブ化しました");
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`アクティブ化失敗: ${error.message}`);
    },
  });

  const batchActivateMutation = trpc.accounts.batchActivate.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`一括アクティブ化失敗: ${error.message}`);
    },
  });

  const assignDeviceMutation = trpc.accounts.assignDevice.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      setAssigningAccountId(null);
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`デバイス割り当て失敗: ${error.message}`);
      setAssigningAccountId(null);
    },
  });

  const handleOpenDeviceSelectDialog = (account: {id: number, username: string}) => {
    setSelectedAccountForDevice(account);
    setSelectedDeviceId("");
    setDeviceSelectDialogOpen(true);
  };

  const handleAssignSelectedDevice = () => {
    if (!selectedAccountForDevice || !selectedDeviceId) return;
    setAssigningAccountId(selectedAccountForDevice.id);
    setDeviceSelectDialogOpen(false);
    assignDeviceMutation.mutate({ 
      accountId: selectedAccountForDevice.id,
      deviceId: selectedDeviceId 
    });
  };

  const startDeviceMutation = trpc.device.start.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`起動失敗: ${error.message}`);
    },
  });

  const stopDeviceMutation = trpc.device.stop.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`停止失敗: ${error.message}`);
    },
  });

  const restartDeviceMutation = trpc.device.restart.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`再起動失敗: ${error.message}`);
    },
  });

  const handleDelete = (accountId: number) => {
    if (confirm("このアカウントを削除してもよろしいですか？")) {
      deleteMutation.mutate({ accountId });
    }
  };

  const handleRegister = (accountId: number) => {
    registerMutation.mutate({ accountId });
    toast.info("登録処理を開始しました...");
  };

  const handleStartDevice = (deviceId: string) => {
    startDeviceMutation.mutate({ deviceId });
    toast.info("デバイスを起動しています...");
  };

  const handleStopDevice = (deviceId: string) => {
    stopDeviceMutation.mutate({ deviceId });
    toast.info("デバイスを停止しています...");
  };

  const handleRestartDevice = (deviceId: string) => {
    restartDeviceMutation.mutate({ deviceId });
    toast.info("デバイスを再起動しています...");
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: "𝕏",
      tiktok: "🎵",
      instagram: "📷",
      facebook: "👥",
    };
    return icons[platform] || "📱";
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      twitter: "X (Twitter)",
      tiktok: "TikTok",
      instagram: "Instagram",
      facebook: "Facebook",
    };
    return names[platform] || platform;
  };

  const openDuoPlusDashboard = (deviceId: string) => {
    const url = `https://my.duoplus.net/images?keyword=${deviceId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter and sort accounts
  const filteredAndSortedAccounts = accounts
    ? accounts
        .filter(account => selectedPlatform === "all" || account.platform === selectedPlatform)
        .sort((a, b) => {
          let comparison = 0;
          
          switch (sortField) {
            case "username":
              comparison = a.username.localeCompare(b.username);
              break;
            case "status":
              comparison = a.status.localeCompare(b.status);
              break;
            case "createdAt":
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
          }
          
          return sortOrder === "asc" ? comparison : -comparison;
        })
    : [];

  // Count accounts by platform
  const platformCounts = accounts
    ? {
        all: accounts.length,
        twitter: accounts.filter(a => a.platform === "twitter").length,
        facebook: accounts.filter(a => a.platform === "facebook").length,
        instagram: accounts.filter(a => a.platform === "instagram").length,
        tiktok: accounts.filter(a => a.platform === "tiktok").length,
      }
    : { all: 0, twitter: 0, facebook: 0, instagram: 0, tiktok: 0 };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>アカウント</CardTitle>
              <CardDescription>SNSアカウントを管理</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => batchActivateMutation.mutate()}
                disabled={batchActivateMutation.isPending || !accounts?.some(a => a.status === 'pending')}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                {batchActivateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Power className="h-4 w-4 mr-2" />
                )}
                一括アクティブ化
              </Button>
              <Button
                variant="outline"
                onClick={() => syncDeviceIdsMutation.mutate()}
                disabled={syncDeviceIdsMutation.isPending}
              >
                {syncDeviceIdsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                デバイスID同期
              </Button>
              <Link href="/accounts/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  アカウント追加
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedPlatform} onValueChange={(value) => setSelectedPlatform(value as Platform)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">
                すべて ({platformCounts.all})
              </TabsTrigger>
              <TabsTrigger value="twitter">
                𝕏 X ({platformCounts.twitter})
              </TabsTrigger>
              <TabsTrigger value="facebook">
                👥 Facebook ({platformCounts.facebook})
              </TabsTrigger>
              <TabsTrigger value="instagram">
                📷 Instagram ({platformCounts.instagram})
              </TabsTrigger>
              <TabsTrigger value="tiktok">
                🎵 TikTok ({platformCounts.tiktok})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedPlatform} className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">プラットフォーム</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("username")}
                          className="-ml-3"
                        >
                          ユーザー名
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>X Handle</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("status")}
                          className="-ml-3"
                        >
                          ステータス
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>デバイスID</TableHead>
                      <TableHead>プロキシ</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort("createdAt")}
                          className="-ml-3"
                        >
                          作成日時
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          アカウントがありません
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getPlatformIcon(account.platform)}</span>
                              <span className="text-sm text-muted-foreground hidden sm:inline">
                                {getPlatformName(account.platform)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{account.username}</TableCell>
                          <TableCell>
                            {(account as any).xHandle ? (
                              <code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                @{(account as any).xHandle}
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-sm">未設定</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.status === "active" ? "default" : "secondary"}>
                              {account.status === "active" ? "アクティブ" : "保留中"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {account.deviceId ? (
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {account.deviceId}
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-sm">未設定</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.proxyId ? (
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {account.proxyId}
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(account.createdAt).toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {account.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => activateMutation.mutate({ accountId: account.id })}
                                  disabled={activateMutation.isPending}
                                  title="アクティブ化"
                                  className="text-green-600 border-green-300 hover:bg-green-50"
                                >
                                  {activateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Power className="h-4 w-4 mr-1" />
                                  )}
                                  アクティブ化
                                </Button>
                              )}
                              {!account.deviceId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDeviceSelectDialog({id: account.id, username: account.username})}
                                  disabled={assigningAccountId !== null}
                                  title="デバイスを割り当て"
                                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                >
                                  {assigningAccountId === account.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Smartphone className="h-4 w-4 mr-1" />
                                  )}
                                  デバイス割当
                                </Button>
                              )}
                              {account.deviceId && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStartDevice(account.deviceId!)}
                                    disabled={startDeviceMutation.isPending}
                                    title="デバイスを起動"
                                  >
                                    <Power className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStopDevice(account.deviceId!)}
                                    disabled={stopDeviceMutation.isPending}
                                    title="デバイスを停止"
                                  >
                                    <PowerOff className="h-4 w-4 text-red-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRestartDevice(account.deviceId!)}
                                    disabled={restartDeviceMutation.isPending}
                                    title="デバイスを再起動"
                                  >
                                    <RotateCw className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openDuoPlusDashboard(account.deviceId!)}
                                    title="DuoPlusで表示"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Link href={`/accounts/${account.id}`}>
                                <Button variant="outline" size="sm">
                                  詳細
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(account.id)}
                                disabled={deleteMutation.isPending}
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* Device Selection Dialog */}
      <Dialog open={deviceSelectDialogOpen} onOpenChange={setDeviceSelectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>デバイスを選択</DialogTitle>
            <DialogDescription>
              {selectedAccountForDevice?.username} に割り当てるデバイスを選択してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoadingDevices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">デバイスを読み込み中...</span>
              </div>
            ) : duoplusDevices && duoplusDevices.length > 0 ? (
              <>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="デバイスを選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {duoplusDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            device.status === 'running' ? 'bg-green-500' : 
                            device.status === 'stopped' ? 'bg-gray-400' : 'bg-yellow-500'
                          }`} />
                          <span>{device.name}</span>
                          <span className="text-muted-foreground text-xs">({device.deviceId})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeviceSelectDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button 
                    onClick={handleAssignSelectedDevice}
                    disabled={!selectedDeviceId}
                  >
                    割り当てる
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>利用可能なデバイスがありません</p>
                <p className="text-sm">DuoPlusでデバイスを追加してください</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
