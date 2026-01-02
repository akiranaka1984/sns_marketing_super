import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Shuffle, RefreshCw, Settings, Power, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Proxies() {
  const [csvInput, setCsvInput] = useState("");
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, any>>({});
  const [togglingDevices, setTogglingDevices] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const { data: proxies = [], isLoading } = trpc.proxy.list.useQuery();
  const { data: proxyStatus } = trpc.proxy.getProxyStatus.useQuery();
  
  const uploadMutation = trpc.proxy.uploadCSV.useMutation({
    onSuccess: () => {
      alert("プロキシがアップロードされました");
      setCsvInput("");
      utils.proxy.list.invalidate();
    },
    onError: (error: any) => {
      alert("エラー: " + error.message);
    },
  });

  const autoAssignMutation = trpc.proxy.autoAssign.useMutation({
    onSuccess: (result) => {
      alert(`${result.assigned}個のプロキシを割り当てました`);
      utils.proxy.list.invalidate();
    },
    onError: (error: any) => {
      alert("エラー: " + error.message);
    },
  });

  const deleteMutation = trpc.proxy.delete.useMutation({
    onSuccess: () => {
      alert("プロキシが削除されました");
      utils.proxy.list.invalidate();
    },
    onError: (error: any) => {
      alert("エラー: " + error.message);
    },
  });

  const syncMutation = trpc.proxy.syncToDuoPlus.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        if (result.errors && result.errors.length > 0) {
          toast.error(`エラー詳細: ${result.errors.join(', ')}`);
        }
      } else {
        toast.error(result.message);
      }
      utils.proxy.list.invalidate();
      utils.proxy.getProxyStatus.invalidate();
    },
    onError: (error: any) => {
      toast.error("同期失敗: " + error.message);
    },
  });

  const powerOnMutation = trpc.device.start.useMutation({
    onSuccess: (_: any, variables: any) => {
      toast.success(`デバイス ${variables.deviceId} を起動しました`);
      refreshDeviceStatus(variables.deviceId);
      setTogglingDevices(prev => {
        const next = new Set(prev);
        next.delete(variables.deviceId);
        return next;
      });
    },
    onError: (error: any, variables: any) => {
      toast.error(`起動失敗: ${error.message}`);
      setTogglingDevices(prev => {
        const next = new Set(prev);
        next.delete(variables.deviceId);
        return next;
      });
    },
  });

  const powerOffMutation = trpc.device.stop.useMutation({
    onSuccess: (_: any, variables: any) => {
      toast.success(`デバイス ${variables.deviceId} を停止しました`);
      refreshDeviceStatus(variables.deviceId);
      setTogglingDevices(prev => {
        const next = new Set(prev);
        next.delete(variables.deviceId);
        return next;
      });
    },
    onError: (error: any, variables: any) => {
      toast.error(`停止失敗: ${error.message}`);
      setTogglingDevices(prev => {
        const next = new Set(prev);
        next.delete(variables.deviceId);
        return next;
      });
    },
  });

  const setProxyMutation = trpc.proxy.setProxyToDuoPlus.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      utils.proxy.list.invalidate();
      utils.proxy.getProxyStatus.invalidate();
    },
    onError: (error: any) => {
      toast.error("設定失敗: " + error.message);
    },
  });

  const handleUpload = () => {
    if (!csvInput.trim()) {
      alert("プロキシ情報を入力してください");
      return;
    }
    uploadMutation.mutate({ csvContent: csvInput });
  };

  const handleAutoAssign = () => {
    autoAssignMutation.mutate();
  };

  const handleDelete = (id: number) => {
    if (confirm("このプロキシを削除してもよろしいですか？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSync = () => {
    if (confirm("割り当て済みのプロキシをDuoPlusに同期しますか？")) {
      syncMutation.mutate();
    }
  };

  const refreshDeviceStatus = async (deviceId: string) => {
    try {
      const status = await utils.device.getStatus.fetch({ deviceId });
      setDeviceStatuses(prev => ({ ...prev, [deviceId]: status }));
    } catch (error) {
      console.error('Failed to refresh device status:', error);
    }
  };

  const handlePowerToggle = (deviceId: string, currentStatus: number) => {
    setTogglingDevices(prev => new Set(prev).add(deviceId));
    if (currentStatus === 1) {
      powerOffMutation.mutate({ deviceId });
    } else {
      powerOnMutation.mutate({ deviceId });
    }
  };

  useEffect(() => {
    const loadDeviceStatuses = async () => {
      console.log('[Proxies] Loading device statuses for', proxies.length, 'proxies');
      for (const proxy of proxies) {
        if (proxy.assignedAccountId) {
          try {
            console.log(`[Proxies] Fetching account info for account #${proxy.assignedAccountId}`);
            const account = await utils.accounts.byId.fetch({ id: proxy.assignedAccountId });
            console.log(`[Proxies] Account #${proxy.assignedAccountId} device ID:`, account?.deviceId);
            if (account?.deviceId) {
              // Store account-device mapping
              setDeviceStatuses(prev => ({
                ...prev,
                [`account_${proxy.assignedAccountId}`]: { deviceId: account.deviceId }
              }));
              // Fetch device status
              console.log(`[Proxies] Fetching device status for device ${account.deviceId}`);
              const status = await utils.device.getStatus.fetch({ deviceId: account.deviceId });
              console.log(`[Proxies] Device ${account.deviceId} status:`, status);
              const deviceId = account.deviceId;
              setDeviceStatuses(prev => ({
                ...prev,
                [deviceId]: status
              }));
            }
          } catch (error) {
            console.error(`Failed to load device status for account ${proxy.assignedAccountId}:`, error);
          }
        }
      }
    };
    if (proxies.length > 0) {
      loadDeviceStatuses();
    }
  }, [proxies]);

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">プロキシ管理</h1>
        <p className="text-muted-foreground mt-2">
          プロキシの一括登録と自動割り当てを管理
        </p>
      </div>

      {/* CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>プロキシCSVアップロード</CardTitle>
          <CardDescription>
            プロキシ情報をCSV形式で一括登録します。形式: host:port:username:password（1行に1つ）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="例:&#10;sg.922s5.net:6300:10644873LJ-zone-custom-region-JP-sessid-SXPc5lpV:5hlcoaXa&#10;sg.922s5.net:6300:10644873LJ-zone-custom-region-JP-sessid-QhYKpAR1:5hlcoaXa"
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !csvInput.trim()}
            >
              <Upload className="h-4 w-4 mr-2" />
              アップロード
            </Button>
            <Button
              onClick={handleAutoAssign}
              disabled={autoAssignMutation.isPending || proxies.length === 0}
              variant="secondary"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              自動割り当て
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending || proxies.length === 0}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              DuoPlusに同期
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Proxy List Section */}
      <Card>
        <CardHeader>
          <CardTitle>プロキシ一覧</CardTitle>
          <CardDescription>
            登録されているプロキシとその割り当て状況
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              読み込み中...
            </div>
          ) : proxies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              プロキシが登録されていません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ホスト</TableHead>
                  <TableHead>ポート</TableHead>
                  <TableHead>ユーザー名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>割り当て先</TableHead>
                  <TableHead>DuoPlus設定状況</TableHead>
                  <TableHead>デバイスステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxies.map((proxy) => (
                  <TableRow key={proxy.id}>
                    <TableCell className="font-mono text-sm">{proxy.host}</TableCell>
                    <TableCell className="font-mono text-sm">{proxy.port}</TableCell>
                    <TableCell className="font-mono text-sm truncate max-w-[200px]">
                      {proxy.username}
                    </TableCell>
                    <TableCell>
                      <Badge variant={proxy.status === "available" ? "default" : "secondary"}>
                        {proxy.status === "available" ? "利用可能" : "割り当て済み"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {proxy.assignedAccountId ? `Account #${proxy.assignedAccountId}` : "-"}
                    </TableCell>
                    <TableCell>
                      {proxy.assignedAccountId && proxyStatus ? (
                        <Badge variant={proxyStatus[proxy.id] ? "default" : "destructive"}>
                          {proxyStatus[proxy.id] ? "設定済み" : "未設定"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Get device ID from assigned account
                        const deviceId = proxy.assignedAccountId ? 
                          (deviceStatuses[`account_${proxy.assignedAccountId}`] || {}).deviceId : null;
                        const status = deviceId ? deviceStatuses[deviceId] : null;
                        const isToggling = deviceId ? togglingDevices.has(deviceId) : false;

                        if (!proxy.assignedAccountId || !deviceId) {
                          return <span className="text-sm text-muted-foreground">-</span>;
                        }

                        if (!status) {
                          return <Badge variant="outline">読み込み中...</Badge>;
                        }

                        const statusColor = status.status === 1 ? "default" : 
                                          status.status === 0 ? "secondary" : "outline";

                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant={statusColor}>
                              {status.statusText}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePowerToggle(deviceId, status.status)}
                              disabled={isToggling}
                              title={status.status === 1 ? "デバイスを停止" : "デバイスを起動"}
                            >
                              {isToggling ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Power className={`h-4 w-4 ${status.status === 1 ? 'text-green-600' : 'text-gray-400'}`} />
                              )}
                            </Button>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {proxy.assignedAccountId && proxyStatus && !proxyStatus[proxy.id] && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProxyMutation.mutate({ proxyId: proxy.id })}
                            disabled={setProxyMutation.isPending}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            DuoPlusに設定
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(proxy.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
