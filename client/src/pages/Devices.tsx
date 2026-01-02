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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { 
  Smartphone, 
  Power, 
  PowerOff, 
  RefreshCw, 
  Activity, 
  AlertCircle,
  Monitor,
  Link2,
  Unlink,
  ExternalLink,
  Twitter,
  Instagram,
  Facebook,
  Video
} from "lucide-react";
import { toast } from "sonner";

// プラットフォームアイコンを取得
function getPlatformIcon(platform: string) {
  switch (platform.toLowerCase()) {
    case "twitter":
    case "x":
      return <Twitter className="h-4 w-4" />;
    case "instagram":
      return <Instagram className="h-4 w-4" />;
    case "facebook":
      return <Facebook className="h-4 w-4" />;
    case "tiktok":
      return <Video className="h-4 w-4" />;
    default:
      return <Smartphone className="h-4 w-4" />;
  }
}

export default function Devices() {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedDeviceForLink, setSelectedDeviceForLink] = useState<string | null>(null);
  const [selectedAccountForLink, setSelectedAccountForLink] = useState<string | null>(null);

  // Queries
  const accountsQuery = trpc.accounts.list.useQuery();
  const duoplusDevicesQuery = trpc.device.listDuoPlusDevices.useQuery();
  
  // DuoPlusデバイスとアカウントの紐付けマップを作成
  const deviceAccountsMap = new Map<string, any[]>();
  accountsQuery.data?.forEach((account) => {
    if (account.deviceId) {
      if (!deviceAccountsMap.has(account.deviceId)) {
        deviceAccountsMap.set(account.deviceId, []);
      }
      deviceAccountsMap.get(account.deviceId)!.push(account);
    }
  });

  // 紐付けられていないアカウント
  const unlinkedAccounts = accountsQuery.data?.filter((account) => !account.deviceId) || [];

  // Mutations
  const powerOnMutation = trpc.device.start.useMutation({
    onSuccess: () => {
      toast.success("デバイスを起動しました");
      duoplusDevicesQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const powerOffMutation = trpc.device.stop.useMutation({
    onSuccess: () => {
      toast.success("デバイスを停止しました");
      duoplusDevicesQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const linkAccountMutation = trpc.accounts.linkDevice.useMutation({
    onSuccess: () => {
      toast.success("アカウントをデバイスに紐付けました");
      accountsQuery.refetch();
      setLinkDialogOpen(false);
      setSelectedDeviceForLink(null);
      setSelectedAccountForLink(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const unlinkAccountMutation = trpc.accounts.unlinkDevice.useMutation({
    onSuccess: () => {
      toast.success("アカウントの紐付けを解除しました");
      accountsQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
      case "active":
        return <Badge variant="default" className="gap-1 bg-green-600"><Activity className="h-3 w-3" />起動中</Badge>;
      case "stopped":
      case "pending":
        return <Badge variant="outline" className="gap-1"><PowerOff className="h-3 w-3" />停止中</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />エラー</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleLinkAccount = () => {
    if (selectedDeviceForLink && selectedAccountForLink) {
      linkAccountMutation.mutate({
        accountId: parseInt(selectedAccountForLink),
        deviceId: selectedDeviceForLink,
      });
    }
  };

  const handleUnlinkAccount = (accountId: number) => {
    unlinkAccountMutation.mutate({ accountId });
  };

  const openDuoPlusDevice = (deviceId: string) => {
    window.open(`https://www.duoplus.net/dashboard/cloud-phone?deviceId=${deviceId}`, "_blank");
  };

  // DuoPlusデバイス一覧
  const duoplusDevices = duoplusDevicesQuery.data || [];
  
  // 統計情報
  const totalDevices = duoplusDevices.length;
  const runningDevices = duoplusDevices.filter((d: any) => d.status === "running").length;
  const linkedDevices = duoplusDevices.filter((d: any) => deviceAccountsMap.has(d.deviceId)).length;

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">デバイス管理</h1>
          <p className="text-muted-foreground">
            DuoPlusデバイスとSNSアカウントの紐付けを管理
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              duoplusDevicesQuery.refetch();
              accountsQuery.refetch();
            }}
            disabled={duoplusDevicesQuery.isLoading || accountsQuery.isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${duoplusDevicesQuery.isLoading ? "animate-spin" : ""}`} />
            更新
          </Button>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DuoPlusデバイス</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              DuoPlusに登録済み
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">起動中</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningDevices}</div>
            <p className="text-xs text-muted-foreground">
              アクティブなデバイス
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">紐付け済み</CardTitle>
            <Link2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{linkedDevices}</div>
            <p className="text-xs text-muted-foreground">
              アカウント紐付け済み
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未紐付けアカウント</CardTitle>
            <Unlink className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unlinkedAccounts.length}</div>
            <p className="text-xs text-muted-foreground">
              デバイス未設定
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DuoPlusデバイス一覧 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            DuoPlusデバイス一覧
          </CardTitle>
          <CardDescription>
            DuoPlusに登録されている{totalDevices}台のデバイスと、紐付けられているSNSアカウント
          </CardDescription>
        </CardHeader>
        <CardContent>
          {duoplusDevicesQuery.isLoading ? (
            <p className="text-center text-muted-foreground py-8">DuoPlusからデバイス情報を取得中...</p>
          ) : duoplusDevices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>デバイス名</TableHead>
                  <TableHead>デバイスID</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>紐付けアカウント</TableHead>
                  <TableHead>アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duoplusDevices.map((device: any) => {
                  const linkedAccounts = deviceAccountsMap.get(device.deviceId) || [];
                  return (
                    <TableRow key={device.deviceId}>
                      <TableCell className="font-medium">
                        {device.name || device.deviceId}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {device.deviceId}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(device.status)}
                      </TableCell>
                      <TableCell>
                        {linkedAccounts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {linkedAccounts.map((account: any) => (
                              <div key={account.id} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-1 text-sm">
                                {getPlatformIcon(account.platform)}
                                <span>{account.username}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                                  onClick={() => handleUnlinkAccount(account.id)}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">未紐付け</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDeviceForLink(device.deviceId);
                              setLinkDialogOpen(true);
                            }}
                          >
                            <Link2 className="h-4 w-4 mr-1" />
                            紐付け
                          </Button>
                          {device.status === "running" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => powerOffMutation.mutate({ deviceId: device.deviceId })}
                              disabled={powerOffMutation.isPending}
                            >
                              <PowerOff className="h-4 w-4 mr-1" />
                              停止
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => powerOnMutation.mutate({ deviceId: device.deviceId })}
                              disabled={powerOnMutation.isPending}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              起動
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDuoPlusDevice(device.deviceId)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">DuoPlusにデバイスが登録されていません</p>
              <p className="text-sm text-muted-foreground mt-2">
                DuoPlusダッシュボードでデバイスを追加してください
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 未紐付けアカウント一覧 */}
      {unlinkedAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Unlink className="h-5 w-5 text-orange-600" />
              未紐付けアカウント
            </CardTitle>
            <CardDescription>
              デバイスに紐付けられていない{unlinkedAccounts.length}個のSNSアカウント
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>プラットフォーム</TableHead>
                  <TableHead>ユーザー名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(account.platform)}
                        <Badge variant="outline">{account.platform}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{account.username}</TableCell>
                    <TableCell>
                      {getStatusBadge(account.status || "pending")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedAccountForLink(account.id.toString());
                          setLinkDialogOpen(true);
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        デバイスに紐付け
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 紐付けダイアログ */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アカウントとデバイスの紐付け</DialogTitle>
            <DialogDescription>
              SNSアカウントをDuoPlusデバイスに紐付けます。投稿はこのデバイスで実行されます。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">デバイス</label>
              <Select
                value={selectedDeviceForLink || ""}
                onValueChange={setSelectedDeviceForLink}
              >
                <SelectTrigger>
                  <SelectValue placeholder="デバイスを選択" />
                </SelectTrigger>
                <SelectContent>
                  {duoplusDevices.map((device: any) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.name || device.deviceId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">アカウント</label>
              <Select
                value={selectedAccountForLink || ""}
                onValueChange={setSelectedAccountForLink}
              >
                <SelectTrigger>
                  <SelectValue placeholder="アカウントを選択" />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(account.platform)}
                        <span>{account.username}</span>
                        <Badge variant="outline" className="ml-2">{account.platform}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleLinkAccount}
              disabled={!selectedDeviceForLink || !selectedAccountForLink || linkAccountMutation.isPending}
            >
              {linkAccountMutation.isPending ? "紐付け中..." : "紐付ける"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
