import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function XApiSettings() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [bearerToken, setBearerToken] = useState("");

  const { data: settings, refetch } = trpc.xApiSettings.get.useQuery();
  const saveMutation = trpc.xApiSettings.save.useMutation();
  const testMutation = trpc.xApiSettings.test.useMutation();

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ apiKey, apiSecret, bearerToken });
      toast.success("設定を保存しました");
      setApiKey("");
      setApiSecret("");
      setBearerToken("");
      refetch();
    } catch (error) {
      toast.error("保存に失敗しました");
    }
  };

  const handleTest = async () => {
    const result = await testMutation.mutateAsync();
    if (result.success) {
      toast.success(result.message || `接続成功: @${result.user?.username}`);
    } else {
      toast.error(`接続失敗: ${result.error}`);
    }
    refetch();
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>X (Twitter) API 設定</CardTitle>
          <CardDescription>
            X Developer Portalから取得したBearer Tokenを設定します。<br />
            投稿URL自動取得に使用されます（Search APIを使用）。<br />
            <strong>注意:</strong> API KeyとAPI Secretは現在使用されていません。Bearer Tokenのみを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 現在の設定状態 */}
          {settings && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                {settings.hasApiKey ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
                <span>API Key: {settings.hasApiKey ? settings.apiKey : "未設定"}</span>
              </div>
              <div className="flex items-center gap-2">
                {settings.hasApiSecret ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
                <span>API Secret: {settings.hasApiSecret ? "設定済み" : "未設定"}</span>
              </div>
              <div className="flex items-center gap-2">
                {settings.hasBearerToken ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
                <span>Bearer Token: {settings.hasBearerToken ? settings.bearerToken : "未設定"}</span>
              </div>
              {settings.lastTestedAt && (
                <div className="text-sm text-gray-500 mt-2">
                  最終テスト: {new Date(settings.lastTestedAt).toLocaleString()} - 
                  <span className={settings.testResult === "success" ? "text-green-500 ml-1" : "text-red-500 ml-1"}>
                    {settings.testResult === "success" ? "成功" : "失敗"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 新しい設定の入力 */}
          <div className="space-y-4 pt-4 border-t">
            <p className="text-sm text-gray-500">新しい値を入力して保存してください（空欄の場合は既存の値が維持されます）</p>
            
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="新しいAPI Keyを入力"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">API Secret</label>
              <Input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="新しいAPI Secretを入力"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bearer Token</label>
              <Input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="新しいBearer Tokenを入力"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending}>
              {testMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              接続テスト
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
