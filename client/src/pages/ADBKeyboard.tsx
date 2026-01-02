import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Download, CheckCircle, XCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ADBKeyboard() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(null);

  // Get all accounts with device IDs
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  
  // Get ADB Keyboard status for selected device
  const { data: status, refetch: refetchStatus } = trpc.adbkeyboard.getStatus.useQuery(
    { deviceId: selectedDeviceId },
    { enabled: !!selectedDeviceId }
  );

  const installMutation = trpc.adbkeyboard.install.useMutation({
    onSuccess: (result) => {
      setIsInstalling(false);
      setInstallResult(result);
      
      if (result.success) {
        toast.success('インストール成功', {
          description: result.message,
        });
        refetchStatus();
      } else {
        toast.error('インストール失敗', {
          description: result.message,
        });
      }
    },
    onError: (error) => {
      setIsInstalling(false);
      setInstallResult({ success: false, message: error.message });
      toast.error('エラー', {
        description: error.message,
      });
    },
  });

  const handleInstall = () => {
    if (!selectedDeviceId) {
      toast.error('デバイスを選択してください');
      return;
    }

    setIsInstalling(true);
    setInstallResult(null);
    installMutation.mutate({ deviceId: selectedDeviceId });
  };

  const devicesWithIds = accounts?.filter(acc => acc.deviceId) || [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ADBKeyboard インストール</h1>
        <p className="text-muted-foreground mt-2">
          デバイスにADBKeyboardをインストールして、プログラムからテキスト入力を制御できるようにします
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>ADBKeyboardとは？</AlertTitle>
        <AlertDescription>
          ADBKeyboardは、ADBコマンド経由でAndroidデバイスにテキストを入力できるIME（入力メソッド）です。
          自動化スクリプトでテキストフィールドに文字を入力する際に必要です。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>デバイス選択</CardTitle>
          <CardDescription>
            ADBKeyboardをインストールするデバイスを選択してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">デバイス</label>
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="デバイスを選択..." />
              </SelectTrigger>
              <SelectContent>
                {accountsLoading ? (
                  <SelectItem value="loading" disabled>読み込み中...</SelectItem>
                ) : devicesWithIds.length === 0 ? (
                  <SelectItem value="none" disabled>デバイスIDが設定されたアカウントがありません</SelectItem>
                ) : (
                  devicesWithIds.map((account) => (
                    <SelectItem key={account.id} value={account.deviceId!}>
                      {account.username} ({account.platform}) - {account.deviceId}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedDeviceId && status && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">インストール状態:</span>
                {status.installed ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    インストール済み
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    未インストール
                  </span>
                )}
              </div>
              {status.installed && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">IME有効状態:</span>
                  {status.enabled ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      有効
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <XCircle className="h-4 w-4" />
                      無効
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleInstall}
            disabled={!selectedDeviceId || isInstalling}
            className="w-full"
            size="lg"
          >
            {isInstalling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                インストール中...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                ADBKeyboardをインストール
              </>
            )}
          </Button>

          {installResult && (
            <Alert variant={installResult.success ? 'default' : 'destructive'}>
              {installResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {installResult.success ? 'インストール成功' : 'インストール失敗'}
              </AlertTitle>
              <AlertDescription>{installResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>インストール手順</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>デバイスを選択してください</li>
            <li>「ADBKeyboardをインストール」ボタンをクリックします</li>
            <li>インストールが完了するまで待ちます（通常30秒〜2分）</li>
            <li>インストール成功後、ADBKeyboardが自動的に有効化されます</li>
          </ol>
          <p className="text-muted-foreground mt-4">
            ※ デバイスがオンラインで起動している必要があります
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
