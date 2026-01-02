import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Smartphone, Calendar, Activity, Keyboard, Loader2, Info, ExternalLink, Edit2, Save, X, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
// import { AnalyticsCharts } from "@/components/AnalyticsCharts"; // Removed - using new analytics page
import { useI18n } from "@/contexts/I18nContext";

export default function AccountDetail() {
  const { t } = useI18n();
  const [, params] = useRoute("/accounts/:id");
  const accountId = params?.id ? parseInt(params.id) : 0;
  const [isEditingXHandle, setIsEditingXHandle] = useState(false);
  const [xHandleInput, setXHandleInput] = useState("");
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const utils = trpc.useUtils();

  const { data: account, isLoading } = trpc.accounts.byId.useQuery(
    { id: accountId },
    {
      refetchInterval: 60000, // Refetch every 60 seconds
    }
  );
  const { data: devices } = trpc.devices.list.useQuery(undefined, {
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  const updateAccountMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      toast.success("X Handleを更新しました");
      setIsEditingXHandle(false);
      utils.accounts.byId.invalidate({ id: accountId });
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const updateDeviceMutation = trpc.accounts.updateDevice.useMutation({
    onSuccess: () => {
      toast.success("デバイスを変更しました");
      setIsDeviceDialogOpen(false);
      utils.accounts.byId.invalidate({ id: accountId });
    },
    onError: (error: any) => {
      toast.error(`デバイス変更失敗: ${error.message}`);
    },
  });

  const handleEditXHandle = () => {
    setXHandleInput((account as any)?.xHandle || "");
    setIsEditingXHandle(true);
  };

  const handleSaveXHandle = () => {
    updateAccountMutation.mutate({
      accountId,
      xHandle: xHandleInput.trim(),
    });
  };

  const handleCancelEdit = () => {
    setIsEditingXHandle(false);
    setXHandleInput("");
  };

  const handleChangeDevice = () => {
    setSelectedDeviceId(account?.deviceId || "");
    setIsDeviceDialogOpen(true);
  };

  const handleSaveDevice = () => {
    if (!selectedDeviceId) {
      toast.error("デバイスを選択してください");
      return;
    }
    updateDeviceMutation.mutate({
      accountId,
      deviceId: selectedDeviceId,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container py-8">
          <p className="text-slate-500">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-slate-500 mb-4">Account not found</p>
              <Button asChild>
                <Link href="/accounts">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('accountDetail.backToAccounts')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const accountDevice = devices?.find(d => d.deviceId === account.deviceId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Link>
          </Button>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            {account.username}
          </h1>
          <p className="text-slate-600 capitalize">
            {t('accounts.platform.' + account.platform)} {t('accountDetail.account')}
          </p>
        </div>

        {/* Account Info */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {t('accountDetail.status')}
                </CardTitle>
                <Activity className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  account.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : account.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : account.status === 'suspended'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {account.status}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {t('accountDetail.device')}
                </CardTitle>
                <Smartphone className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-900 font-medium">
                {accountDevice?.deviceName || t('accountDetail.unknownDevice')}
              </p>
              {accountDevice && (
                <>
                  <p className="text-xs text-slate-500 mt-1">
                    Device ID: {accountDevice.deviceId}
                  </p>
                  <ADBKeyboardInstaller deviceId={accountDevice.deviceId} />
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={handleChangeDevice}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                デバイスを変更
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {t('accountDetail.created')}
                </CardTitle>
                <Calendar className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-900 font-medium">
                {new Date(account.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(account.createdAt).toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {t('accountDetail.performanceAnalytics')}
          </h2>
        </div>

        {/* Analytics charts removed - use /analytics page instead */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">詳細な分析は「パフォーマンス分析」ページをご覧ください</p>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{t('accountDetail.accountDetails')}</CardTitle>
            <CardDescription>{t('accountDetail.accountDetailsSubtitle')}</CardDescription>
            <CardDescription>
              Complete information about this account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-slate-600">Username</dt>
                <dd className="text-sm text-slate-900 mt-1">{account.username}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">X Handle (投稿URL取得用)</dt>
                {isEditingXHandle ? (
                  <dd className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">@</span>
                      <Input
                        value={xHandleInput}
                        onChange={(e) => setXHandleInput(e.target.value)}
                        placeholder="例: elonmusk"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveXHandle}
                        disabled={updateAccountMutation.isPending}
                      >
                        {updateAccountMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateAccountMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      X上のユーザー名を入力してください（@なし）
                    </p>
                  </dd>
                ) : (
                  <dd className="text-sm text-slate-900 mt-1">
                    <div className="flex items-center gap-2">
                      {(account as any).xHandle ? (
                        <code className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          @{(account as any).xHandle}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditXHandle}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Platform</dt>
                <dd className="text-sm text-slate-900 mt-1 capitalize">{account.platform}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Status</dt>
                <dd className="text-sm text-slate-900 mt-1 capitalize">{account.status}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Device ID</dt>
                <dd className="text-sm text-slate-900 mt-1">{account.deviceId || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Created At</dt>
                <dd className="text-sm text-slate-900 mt-1">
                  {new Date(account.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Last Updated</dt>
                <dd className="text-sm text-slate-900 mt-1">
                  {new Date(account.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Device Change Dialog */}
        <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>デバイスを変更</DialogTitle>
              <DialogDescription>
                このアカウントに割り当てるデバイスを選択してください。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="device-select">利用可能なデバイス</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger id="device-select" className="mt-2">
                  <SelectValue placeholder="デバイスを選択" />
                </SelectTrigger>
                <SelectContent>
                  {devices?.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.deviceName} ({device.deviceId}) - {device.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeviceDialogOpen(false)}
                disabled={updateDeviceMutation.isPending}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSaveDevice}
                disabled={updateDeviceMutation.isPending}
              >
                {updateDeviceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    変更中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ADBKeyboard Installer Component
function ADBKeyboardInstaller({ deviceId }: { deviceId: string }) {
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<{ installed: boolean; enabled?: boolean } | null>(null);
  
  const { data: adbStatus, refetch: refetchStatus } = trpc.adbkeyboard.getStatus.useQuery(
    { deviceId },
    {
      refetchInterval: status?.installed ? false : 5000,
    }
  );
  
  const installMutation = trpc.adbkeyboard.install.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        alert('ADBKeyboard installed successfully!');
        refetchStatus();
      } else {
        alert(`Installation failed: ${result.message}`);
      }
      setInstalling(false);
    },
    onError: (error) => {
      alert(`Installation error: ${error.message}`);
      setInstalling(false);
    },
  });
  
  const handleInstall = () => {
    if (confirm('Install ADBKeyboard on this device? This will take 1-2 minutes.')) {
      setInstalling(true);
      installMutation.mutate({ deviceId });
    }
  };
  
  if (!adbStatus) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-600">
            ADBKeyboard: {adbStatus.installed ? (
              <span className="text-green-600 font-medium">Installed</span>
            ) : (
              <span className="text-orange-600 font-medium">Not Installed</span>
            )}
          </span>
        </div>
        {!adbStatus.installed && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleInstall}
            disabled={installing}
            className="h-7 text-xs"
          >
            {installing ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Installing...
              </>
            ) : (
              'Install'
            )}
          </Button>
        )}
      </div>
      {adbStatus.installed && adbStatus.enabled !== undefined && (
        <p className="text-xs text-slate-500 mt-1">
          IME: {adbStatus.enabled ? 'Enabled' : 'Disabled'}
        </p>
      )}
      {!adbStatus.installed && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-900">
              <p className="font-medium mb-2">Manual Installation Required</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>
                  Download ADBKeyboard.apk:
                  <a 
                    href="https://files.manuscdn.com/user_upload_by_module/session_file/310519663209474318/mVjTbmzXsamFGxlj.apk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 hover:underline inline-flex items-center"
                  >
                    Download APK
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </li>
                <li>
                  Upload to DuoPlus:
                  <a 
                    href="https://www.duoplus.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 hover:underline inline-flex items-center"
                  >
                    DuoPlus Dashboard
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                  {' → Cloud Drive → Upload File'}
                </li>
                <li>Click "Install" button above after upload</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
