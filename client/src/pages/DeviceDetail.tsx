import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Smartphone, Power, PowerOff, RotateCw, Twitter, Instagram, Facebook } from "lucide-react";
import { toast } from "sonner";
// TikTokIcon is not available, using fallback

export default function DeviceDetail() {
  const [, params] = useRoute("/devices/:id");
  const deviceId = params?.id;

  if (!deviceId) {
    return <div>デバイスIDが指定されていません</div>;
  }

  // Queries
  // Get all accounts and filter by deviceId on the client side
  const allAccountsQuery = trpc.accounts.list.useQuery();
  const accounts = allAccountsQuery.data?.filter(acc => acc.deviceId === deviceId) || [];
  const deviceStatusQuery = trpc.device.getStatus.useQuery({ deviceId });

  // Mutations
  const startMutation = trpc.device.start.useMutation({
    onSuccess: () => {
      toast.success("デバイスを起動しました");
      deviceStatusQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const stopMutation = trpc.device.stop.useMutation({
    onSuccess: () => {
      toast.success("デバイスを停止しました");
      deviceStatusQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const restartMutation = trpc.device.restart.useMutation({
    onSuccess: () => {
      toast.success("デバイスを再起動しました");
      deviceStatusQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "twitter":
        return <Twitter className="h-5 w-5" />;
      case "tiktok":
        return <Smartphone className="h-5 w-5" />;
      case "instagram":
        return <Instagram className="h-5 w-5" />;
      case "facebook":
        return <Facebook className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">アクティブ</Badge>;
      case "pending":
        return <Badge variant="secondary">保留中</Badge>;
      case "suspended":
        return <Badge variant="destructive">停止中</Badge>;
      case "failed":
        return <Badge variant="destructive">失敗</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">デバイス詳細</h1>
          <p className="text-muted-foreground">デバイスID: {deviceId}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startMutation.mutate({ deviceId })}
            disabled={startMutation.isPending}
          >
            <Power className="h-4 w-4 mr-2" />
            起動
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stopMutation.mutate({ deviceId })}
            disabled={stopMutation.isPending}
          >
            <PowerOff className="h-4 w-4 mr-2" />
            停止
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => restartMutation.mutate({ deviceId })}
            disabled={restartMutation.isPending}
          >
            <RotateCw className="h-4 w-4 mr-2" />
            再起動
          </Button>
        </div>
      </div>

      {/* Device Status */}
      <Card>
        <CardHeader>
          <CardTitle>デバイスステータス</CardTitle>
          <CardDescription>現在のデバイスの状態</CardDescription>
        </CardHeader>
        <CardContent>
          {deviceStatusQuery.isLoading ? (
            <p>読み込み中...</p>
          ) : deviceStatusQuery.error ? (
            <p className="text-destructive">エラー: {deviceStatusQuery.error.message}</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">ステータス:</span>
                <Badge variant={deviceStatusQuery.data?.status ? "default" : "secondary"}>
                  {deviceStatusQuery.data?.status || "不明"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">デバイス名:</span>
                <span>{deviceStatusQuery.data?.name || "-"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>紐付けられているアカウント</CardTitle>
          <CardDescription>このデバイスで管理されているSNSアカウント</CardDescription>
        </CardHeader>
        <CardContent>
          {allAccountsQuery.isLoading ? (
            <p>読み込み中...</p>
          ) : allAccountsQuery.error ? (
            <p className="text-destructive">エラー: {allAccountsQuery.error.message}</p>
          ) : accounts.length > 0 ? (
            <div className="space-y-4">
              {accounts.map((account: any) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getPlatformIcon(account.platform)}
                    </div>
                    <div>
                      <p className="font-medium">{account.username}</p>
                      <p className="text-sm text-muted-foreground capitalize">{account.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(account.status)}
                    {account.lastLoginAt && (
                      <p className="text-sm text-muted-foreground">
                        最終ログイン: {new Date(account.lastLoginAt).toLocaleString("ja-JP")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">このデバイスに紐付けられているアカウントはありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
