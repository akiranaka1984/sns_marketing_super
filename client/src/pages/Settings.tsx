import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Save, Eye, EyeOff, Upload, Trash2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";


export default function Settings() {

  const [duoplusApiKey, setDuoplusApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [showDuoplusKey, setShowDuoplusKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });
  
  // Get API status
  const { data: apiStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.settings.getApiStatus.useQuery();
  
  // Get saved API keys from database
  const { data: savedApiKeys, isLoading: keysLoading } = trpc.settings.getApiKeys.useQuery();
  
  // Load saved API keys when data is available
  useEffect(() => {
    if (savedApiKeys) {
      if (savedApiKeys.duoplusApiKey && !duoplusApiKey) {
        setDuoplusApiKey(savedApiKeys.duoplusApiKey);
      }
      if (savedApiKeys.openaiApiKey && !openaiApiKey) {
        setOpenaiApiKey(savedApiKeys.openaiApiKey);
      }
    }
  }, [savedApiKeys]);
  
  // Proxy management
  const { data: proxies, isLoading: proxiesLoading, refetch: refetchProxies } = trpc.proxy.list.useQuery();
  
  const uploadProxies = trpc.proxy.uploadCSV.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        setCsvContent("");
        refetchProxies();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });
  
  const autoAssignProxies = trpc.proxy.autoAssign.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchProxies();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });
  
  const deleteProxy = trpc.proxy.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchProxies();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });
  
  // Save API keys
  const saveApiKeys = trpc.settings.saveApiKeys.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setSaveMessage({ type: 'success', text: data.message });
      // Don't clear the API keys after saving - keep them displayed
      refetchStatus();
      // Clear message after 5 seconds
      setTimeout(() => setSaveMessage({ type: null, text: '' }), 5000);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
      setSaveMessage({ type: 'error', text: "エラー: " + error.message });
      // Clear message after 5 seconds
      setTimeout(() => setSaveMessage({ type: null, text: '' }), 5000);
    },
  });
  
  // Test connections - now with input parameter
  const testDuoPlus = trpc.settings.testDuoPlusConnection.useQuery(
    { apiKey: duoplusApiKey || undefined },
    { enabled: false }
  );
  
  const testOpenAI = trpc.settings.testOpenAIConnection.useQuery(
    { apiKey: openaiApiKey || undefined },
    { enabled: false }
  );

  const handleSave = () => {
    if (!duoplusApiKey && !openaiApiKey) {
      toast.warning("少なくとも1つのAPIキーを入力してください");
      return;
    }
    
    saveApiKeys.mutate({
      duoplusApiKey: duoplusApiKey || undefined,
      openaiApiKey: openaiApiKey || undefined,
    });
  };

  const handleTestDuoPlus = () => {
    testDuoPlus.refetch();
  };

  const handleTestOpenAI = () => {
    testOpenAI.refetch();
  };

  if (statusLoading || keysLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">API設定</h1>
        <p className="text-muted-foreground mt-2">
          APIキーの設定と接続テスト
        </p>
      </div>

      {/* DuoPlus API Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            DuoPlus API
            {apiStatus?.duoplus.configured ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <CardDescription>
            デバイス操作とアカウント自動登録に使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">API URL</p>
                <p className="text-sm text-muted-foreground">{apiStatus?.duoplus.apiUrl}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="duoplus-key">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="duoplus-key"
                    type={showDuoplusKey ? "text" : "password"}
                    placeholder={apiStatus?.duoplus.configured ? "●●●●●●●●●●●●" : "APIキーを入力"}
                    value={duoplusApiKey}
                    onChange={(e) => setDuoplusApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDuoplusKey(!showDuoplusKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showDuoplusKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ステータス: {apiStatus?.duoplus.configured ? '設定済み' : '未設定'}
              </p>
            </div>
          </div>

          {!apiStatus?.duoplus.configured && (
            <Alert>
              <AlertDescription>
                DuoPlus APIキーを設定してください。
                <a 
                  href="https://help.duoplus.net/docs/api-reference" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                >
                  APIキーを取得
                  <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleTestDuoPlus}
              disabled={(!apiStatus?.duoplus.configured && !duoplusApiKey) || testDuoPlus.isFetching}
              variant="outline"
            >
              {testDuoPlus.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              接続テスト
            </Button>
          </div>

          {testDuoPlus.data && (
            <Alert variant={testDuoPlus.data.success ? "default" : "destructive"}>
              <AlertDescription className="flex items-center gap-2">
                {testDuoPlus.data.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testDuoPlus.data.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* OpenAI API Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            OpenAI API
            {apiStatus?.openai.configured ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <CardDescription>
            AI投稿内容生成と戦略作成に使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="openai-key"
                  type={showOpenaiKey ? "text" : "password"}
                  placeholder={apiStatus?.openai.configured ? "●●●●●●●●●●●●" : "APIキーを入力"}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ステータス: {apiStatus?.openai.configured ? '設定済み' : '未設定'}
            </p>
          </div>

          {!apiStatus?.openai.configured && (
            <Alert>
              <AlertDescription>
                OpenAI APIキーを設定してください。
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                >
                  APIキーを取得
                  <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleTestOpenAI}
              disabled={(!apiStatus?.openai.configured && !openaiApiKey) || testOpenAI.isFetching}
              variant="outline"
            >
              {testOpenAI.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              接続テスト
            </Button>
          </div>

          {testOpenAI.data && (
            <Alert variant={testOpenAI.data.success ? "default" : "destructive"}>
              <AlertDescription className="flex items-center gap-2">
                {testOpenAI.data.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testOpenAI.data.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Proxy Management */}
      <Card>
        <CardHeader>
          <CardTitle>プロキシ管理</CardTitle>
          <CardDescription>
            プロキシをCSVファイルでアップロードし、アカウントに自動割り当て
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proxy-csv">プロキシCSV</Label>
            <textarea
              id="proxy-csv"
              className="w-full h-32 p-2 border rounded-md font-mono text-sm"
              placeholder="host:port:username:password&#10;sg.922s5.net:6300:user1:pass1&#10;sg.922s5.net:6300:user2:pass2"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              形式: host:port:username:password（1行に1つ）
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => uploadProxies.mutate({ csvContent })}
              disabled={!csvContent || uploadProxies.isPending}
              variant="outline"
            >
              {uploadProxies.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="mr-2 h-4 w-4" />
              アップロード
            </Button>
            <Button 
              onClick={() => autoAssignProxies.mutate()}
              disabled={autoAssignProxies.isPending}
              variant="outline"
            >
              {autoAssignProxies.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className="mr-2 h-4 w-4" />
              自動割り当て
            </Button>
          </div>

          {/* Proxy List */}
          {proxies && proxies.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">プロキシ一覧</h4>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">ホスト</th>
                      <th className="p-2 text-left">ポート</th>
                      <th className="p-2 text-left">ステータス</th>
                      <th className="p-2 text-left">アクション</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proxies.map((proxy) => (
                      <tr key={proxy.id} className="border-t">
                        <td className="p-2">{proxy.host}</td>
                        <td className="p-2">{proxy.port}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            proxy.assignedAccountId ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {proxy.assignedAccountId ? '割り当て済み' : '未割り当て'}
                          </span>
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProxy.mutate({ id: proxy.id })}
                            disabled={deleteProxy.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex flex-col items-end gap-3">
        <Button 
          onClick={handleSave}
          disabled={saveApiKeys.isPending}
          className={`min-w-40 transition-all duration-300 ${saveMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {saveApiKeys.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : saveMessage.type === 'success' ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              保存完了
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              APIキーを保存
            </>
          )}
        </Button>
        {saveMessage.type && (
          <Alert variant={saveMessage.type === 'success' ? 'default' : 'destructive'} className="w-full max-w-md border-2">
            <AlertDescription className="flex items-center gap-2 font-medium">
              {saveMessage.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 flex-shrink-0" />
              )}
              {saveMessage.text}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* API Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>API設定方法</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">1. APIキーを取得</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
              <li>DuoPlus: <a href="https://help.duoplus.net/docs/api-reference" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://help.duoplus.net/docs/api-reference</a></li>
              <li>OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://platform.openai.com/api-keys</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium">2. APIキーを入力して接続テスト</h4>
            <p className="text-sm text-muted-foreground mt-1">
              上記のフォームにAPIキーを入力し、「接続テスト」ボタンで動作を確認してください。接続が成功したら「APIキーを保存」ボタンをクリックしてください。
            </p>
          </div>
          <div>
            <h4 className="font-medium">3. サーバーを再起動</h4>
            <p className="text-sm text-muted-foreground mt-1">
              APIキーを保存した後は、変更を反映するために開発サーバーを再起動してください。
            </p>
          </div>
          <Alert>
            <AlertDescription>
              <strong>ヒント:</strong> 接続テストは保存前でも実行できます。APIキーを入力したら、まず接続テストで動作を確認してから保存することをお勧めします。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
