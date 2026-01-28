import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Activity, 
  AlertTriangle, 
  Bell, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Settings, 
  Smartphone,
  XCircle,
  AlertCircle,
  Eye
} from "lucide-react";

export default function DeviceMonitor() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: dashboard, refetch: refetchDashboard } = trpc.deviceMonitor.getDashboard.useQuery();
  const { data: alertHistory, refetch: refetchAlerts } = trpc.deviceMonitor.getAlertHistory.useQuery();
  const { data: alertSettings, refetch: refetchSettings } = trpc.deviceMonitor.getAlertSettings.useQuery();

  const runMonitoringMutation = trpc.deviceMonitor.runMonitoringCycle.useMutation({
    onSuccess: (result) => {
      toast.success(`監視完了: ${result.devicesChecked}台のデバイスをチェック`);
      refetchDashboard();
      refetchAlerts();
    },
    onError: (error) => {
      toast.error(`監視エラー: ${error.message}`);
    },
  });

  const acknowledgeAlertMutation = trpc.deviceMonitor.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("アラートを確認済みにしました");
      refetchAlerts();
    },
  });

  const resolveAlertMutation = trpc.deviceMonitor.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success("アラートを解決済みにしました");
      refetchAlerts();
    },
  });

  const updateSettingsMutation = trpc.deviceMonitor.updateAlertSettings.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      refetchSettings();
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await runMonitoringMutation.mutateAsync();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500";
      case "stopped": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running": return "稼働中";
      case "stopped": return "停止";
      case "error": return "エラー";
      default: return "不明";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      device_stopped: "デバイス停止",
      device_error: "デバイスエラー",
      device_offline: "デバイスオフライン",
      consecutive_failures: "連続エラー",
      posting_failed: "投稿失敗",
      engagement_drop: "エンゲージメント低下",
      account_issue: "アカウント問題",
    };
    return labels[type] || type;
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">デバイス監視</h1>
            <p className="text-muted-foreground">
              DuoPlusデバイスの稼働状況をリアルタイムで監視
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            今すぐチェック
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総デバイス数</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.stats.totalDevices || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">稼働中</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{dashboard?.stats.runningDevices || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">停止中</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{dashboard?.stats.stoppedDevices || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">エラー</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{dashboard?.stats.errorDevices || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">アクティブアラート</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{dashboard?.stats.activeAlerts || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="devices">
              <Smartphone className="mr-2 h-4 w-4" />
              デバイス状況
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="mr-2 h-4 w-4" />
              アラート履歴
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              アラート設定
            </TabsTrigger>
          </TabsList>

          {/* Devices Tab */}
          <TabsContent value="devices" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboard?.devices.map((device: any) => (
                <Card key={device.deviceId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{device.deviceName || device.deviceId}</CardTitle>
                      <Badge className={getStatusColor(device.currentStatus)}>
                        {getStatusLabel(device.currentStatus)}
                      </Badge>
                    </div>
                    <CardDescription>ID: {device.deviceId}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">最終チェック:</span>
                        <span>
                          {device.lastCheckedAt 
                            ? new Date(device.lastCheckedAt).toLocaleString("ja-JP")
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">連続エラー:</span>
                        <span className={device.consecutiveErrors > 0 ? "text-red-500 font-bold" : ""}>
                          {device.consecutiveErrors}回
                        </span>
                      </div>
                      {device.lastErrorMessage && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
                          {device.lastErrorMessage}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!dashboard?.devices || dashboard.devices.length === 0) && (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">監視中のデバイスがありません</p>
                    <Button variant="outline" className="mt-4" onClick={handleRefresh}>
                      デバイスをスキャン
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>アラート履歴</CardTitle>
                <CardDescription>過去24時間のアラート</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alertHistory?.map((alert: any) => (
                    <div 
                      key={alert.id} 
                      className={`flex items-start justify-between p-4 border rounded-lg ${
                        alert.status === "triggered" ? "border-red-200 bg-red-50" : 
                        alert.status === "acknowledged" ? "border-yellow-200 bg-yellow-50" : 
                        "border-green-200 bg-green-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {alert.status === "triggered" ? (
                          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        ) : alert.status === "acknowledged" ? (
                          <Eye className="h-5 w-5 text-yellow-500 mt-0.5" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alert.title}</span>
                            <Badge variant={getSeverityColor(alert.severity) as any}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">
                              {getAlertTypeLabel(alert.alertType)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(alert.triggeredAt).toLocaleString("ja-JP")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {alert.status === "triggered" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => acknowledgeAlertMutation.mutate({ alertId: alert.id })}
                          >
                            確認
                          </Button>
                        )}
                        {alert.status !== "resolved" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resolveAlertMutation.mutate({ alertId: alert.id })}
                          >
                            解決
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!alertHistory || alertHistory.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>アラートはありません</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>アラート設定</CardTitle>
                <CardDescription>各アラートタイプの通知設定を管理</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alertSettings?.map((setting: any) => (
                    <div 
                      key={setting.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{getAlertTypeLabel(setting.alertType)}</div>
                        <div className="text-sm text-muted-foreground">
                          閾値: {setting.threshold}回 / クールダウン: {setting.cooldownMinutes}分
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">通知</span>
                          <Switch
                            checked={setting.isEnabled}
                            onCheckedChange={(checked) => 
                              updateSettingsMutation.mutate({
                                alertType: setting.alertType,
                                isEnabled: checked,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!alertSettings || alertSettings.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>設定を読み込み中...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
