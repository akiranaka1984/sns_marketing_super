import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Smartphone, Calendar, Activity, Keyboard, Loader2, Info, ExternalLink,
  Edit2, Save, X, RefreshCw, User, BookOpen, Users2, LayoutDashboard, Sparkles, Bot
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import AccountLevelCard from "@/components/AccountLevelCard";
import AccountLearningsTab from "@/components/AccountLearningsTab";
import AccountPersonaTab from "@/components/AccountPersonaTab";
import AccountModelAccountsTab from "@/components/AccountModelAccountsTab";
import AccountProfileTab from "@/components/AccountProfileTab";
import AccountAgentsTab from "@/components/AccountAgentsTab";

export default function AccountDetail() {
  const { t } = useI18n();
  const [, params] = useRoute("/accounts/:id");
  const accountId = params?.id ? parseInt(params.id) : 0;
  const [isEditingXHandle, setIsEditingXHandle] = useState(false);
  const [xHandleInput, setXHandleInput] = useState("");
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const utils = trpc.useUtils();

  const { data: account, isLoading } = trpc.accounts.byId.useQuery(
    { id: accountId },
    { refetchInterval: 60000 }
  );

  const { data: devices } = trpc.device.listDuoPlusDevices.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const { data: growthStats, isLoading: isLoadingGrowth } = trpc.accounts.growthStats.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

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

  const syncGrowthMutation = trpc.accounts.syncGrowth.useMutation({
    onSuccess: (result) => {
      toast.success(`成長データを同期しました: ${result.learningsCount}件の学習、${result.totalXP} XP`);
      utils.accounts.growthStats.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`同期失敗: ${error.message}`);
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
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
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
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Link>
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">
                @{account.username}
              </h1>
              <p className="text-slate-600 capitalize">
                {t('accounts.platform.' + account.platform)} アカウント
              </p>
            </div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                account.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : account.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {account.status}
            </span>
          </div>
        </div>

        {/* Level Card */}
        {growthStats && (
          <div className="mb-6">
            <AccountLevelCard
              level={growthStats.level}
              experiencePoints={growthStats.experiencePoints}
              currentLevelXP={growthStats.currentLevelXP}
              requiredXP={growthStats.requiredXP}
              progressPercent={growthStats.progressPercent}
              totalLearningsCount={growthStats.totalLearningsCount}
              learningsByType={growthStats.learningsByType}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              概要
            </TabsTrigger>
            <TabsTrigger value="learnings" className="gap-2">
              <BookOpen className="h-4 w-4" />
              学習データ
            </TabsTrigger>
            <TabsTrigger value="persona" className="gap-2">
              <User className="h-4 w-4" />
              ペルソナ
            </TabsTrigger>
            <TabsTrigger value="model-accounts" className="gap-2">
              <Users2 className="h-4 w-4" />
              モデル連携
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <Sparkles className="h-4 w-4" />
              プロフィール
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="h-4 w-4" />
              エージェント連携
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      デバイス
                    </CardTitle>
                    <Smartphone className="h-5 w-5 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-900 font-medium">
                    {accountDevice?.name || account.deviceId || "未設定"}
                  </p>
                  {(accountDevice || account.deviceId) && (
                    <>
                      <p className="text-xs text-slate-500 mt-1">
                        ID: {account.deviceId}
                      </p>
                      {account.deviceId && <ADBKeyboardInstaller deviceId={account.deviceId} />}
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
                      作成日
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

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      成長データ同期
                    </CardTitle>
                    <Activity className="h-5 w-5 text-slate-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    既存の学習データから経験値を再計算
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => syncGrowthMutation.mutate({ accountId })}
                    disabled={syncGrowthMutation.isPending}
                  >
                    {syncGrowthMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    同期
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Account Details */}
            <Card>
              <CardHeader>
                <CardTitle>アカウント詳細</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Username</dt>
                    <dd className="text-sm text-slate-900 mt-1">{account.username}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-600">X Handle</dt>
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
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </dd>
                    ) : (
                      <dd className="text-sm text-slate-900 mt-1">
                        <div className="flex items-center gap-2">
                          {(account as any).xHandle ? (
                            <code className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              @{(account as any).xHandle}
                            </code>
                          ) : (
                            <span className="text-slate-400">未設定</span>
                          )}
                          <Button size="sm" variant="ghost" onClick={handleEditXHandle}>
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
                    <dt className="text-sm font-medium text-slate-600">Device ID</dt>
                    <dd className="text-sm text-slate-900 mt-1">{account.deviceId || 'N/A'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Learnings Tab */}
          <TabsContent value="learnings">
            <AccountLearningsTab accountId={accountId} />
          </TabsContent>

          {/* Persona Tab */}
          <TabsContent value="persona">
            <AccountPersonaTab
              accountId={accountId}
              account={{
                personaRole: (account as any).personaRole,
                personaTone: (account as any).personaTone,
                personaCharacteristics: (account as any).personaCharacteristics,
              }}
            />
          </TabsContent>

          {/* Model Accounts Tab */}
          <TabsContent value="model-accounts">
            <AccountModelAccountsTab accountId={accountId} />
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <AccountProfileTab
              accountId={accountId}
              account={{
                username: account.username,
                xHandle: (account as any).xHandle,
                platform: account.platform,
                personaRole: (account as any).personaRole,
                personaTone: (account as any).personaTone,
                personaCharacteristics: (account as any).personaCharacteristics,
              }}
            />
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents">
            <AccountAgentsTab accountId={accountId} />
          </TabsContent>
        </Tabs>

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
                      {device.name} ({device.deviceId}) - {device.status}
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
    { refetchInterval: status?.installed ? false : 5000 }
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
