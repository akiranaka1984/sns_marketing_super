import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Smartphone,
  RefreshCw,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

interface DevicePoolManagerProps {
  onDeviceSelect?: (deviceId: string) => void;
}

export default function DevicePoolManager({ onDeviceSelect }: DevicePoolManagerProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Fetch data
  const { data: devicePool, isLoading: poolLoading, refetch: refetchPool } = trpc.device.getDevicePool.useQuery();
  const { data: accounts = [] } = trpc.accounts.list.useQuery();

  // Mutations
  const assignMutation = trpc.device.assignAccountToDevice.useMutation({
    onSuccess: () => {
      toast.success("アカウントを割り当てました");
      setIsAssignDialogOpen(false);
      setSelectedAccountId(null);
      refetchPool();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const releaseMutation = trpc.device.releaseDevice.useMutation({
    onSuccess: () => {
      toast.success("デバイスを解放しました");
      refetchPool();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "busy":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "offline":
        return <WifiOff className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge variant="default" className="bg-green-500">利用可能</Badge>;
      case "busy":
        return <Badge variant="default" className="bg-blue-500">使用中</Badge>;
      case "offline":
        return <Badge variant="secondary">オフライン</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAssignClick = (deviceId: string) => {
    setSelectedDevice(deviceId);
    setIsAssignDialogOpen(true);
  };

  const handleAssign = () => {
    if (selectedDevice && selectedAccountId) {
      assignMutation.mutate({
        deviceId: selectedDevice,
        accountId: selectedAccountId,
      });
    }
  };

  const handleRelease = (deviceId: string) => {
    releaseMutation.mutate({ deviceId });
  };

  // Get unassigned accounts
  const unassignedAccounts = accounts.filter(
    (a: any) => !a.deviceId || a.deviceId === ""
  );

  if (poolLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                デバイスプール
              </CardTitle>
              <CardDescription>
                利用可能なデバイスの管理とアカウントへの割り当て
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchPool()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              更新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Pool Stats */}
          {devicePool?.stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{devicePool.stats.total}</div>
                <div className="text-sm text-muted-foreground">総数</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{devicePool.stats.available}</div>
                <div className="text-sm text-muted-foreground">利用可能</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{devicePool.stats.busy}</div>
                <div className="text-sm text-muted-foreground">使用中</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-400">{devicePool.stats.offline}</div>
                <div className="text-sm text-muted-foreground">オフライン</div>
              </div>
            </div>
          )}

          {/* Device List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devicePool?.devices?.map((device: any) => (
              <div
                key={device.deviceId}
                className={`border rounded-lg p-4 ${
                  device.status === "available"
                    ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                    : device.status === "busy"
                    ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(device.status)}
                    <span className="font-medium truncate max-w-32">
                      {device.deviceName || device.deviceId.slice(0, 12)}
                    </span>
                  </div>
                  {getStatusBadge(device.status)}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wifi className="h-3 w-3" />
                    <span className="truncate">{device.proxyIp || "プロキシなし"}</span>
                  </div>

                  {device.lastUsedAt && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        最終使用: {new Date(device.lastUsedAt).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  )}

                  {device.assignedAccount && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>@{device.assignedAccount}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {device.status === "available" && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAssignClick(device.deviceId)}
                    >
                      割り当て
                    </Button>
                  )}
                  {device.status === "busy" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleRelease(device.deviceId)}
                    >
                      解放
                    </Button>
                  )}
                  {onDeviceSelect && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeviceSelect(device.deviceId)}
                    >
                      選択
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(!devicePool?.devices || devicePool.devices.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>デバイスが登録されていません</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アカウント割り当て</DialogTitle>
            <DialogDescription>
              デバイス {selectedDevice?.slice(0, 12)}... にアカウントを割り当てます
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select
              value={selectedAccountId?.toString() || ""}
              onValueChange={(v) => setSelectedAccountId(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="アカウントを選択..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedAccounts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    割り当て可能なアカウントがありません
                  </SelectItem>
                ) : (
                  unassignedAccounts.map((account: any) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      @{account.username} ({account.platform})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedAccountId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "割り当て中..." : "割り当て"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
