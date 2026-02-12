import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Save, Eye, EyeOff, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  // OpenAI state
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // X API state
  const [xBearerToken, setXBearerToken] = useState("");
  const [showXBearerToken, setShowXBearerToken] = useState(false);

  // Get API status
  const { data: apiStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.settings.getApiStatus.useQuery();

  // Get saved API keys from database
  const { data: savedApiKeys, isLoading: keysLoading } = trpc.settings.getApiKeys.useQuery();

  // Get X API settings
  const { data: xApiSettings, isLoading: xApiLoading, refetch: refetchXApi } = trpc.xApiSettings.get.useQuery();

  // Load saved API keys when data is available
  useEffect(() => {
    if (savedApiKeys) {
      if (savedApiKeys.openaiApiKey && !openaiApiKey) {
        setOpenaiApiKey(savedApiKeys.openaiApiKey);
      }
    }
  }, [savedApiKeys]);

  // Load X API settings
  useEffect(() => {
    if (xApiSettings) {
      if (xApiSettings.bearerToken && !xBearerToken) {
        setXBearerToken(xApiSettings.bearerToken);
      }
    }
  }, [xApiSettings]);

  // Save OpenAI API keys
  const saveApiKeys = trpc.settings.saveApiKeys.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchStatus();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // Save X API settings
  const saveXApiSettings = trpc.xApiSettings.save.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchXApi();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  // Test X API connection
  const testXApiConnection = trpc.xApiSettings.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const testOpenAI = trpc.settings.testOpenAIConnection.useQuery(
    { apiKey: openaiApiKey || undefined },
    { enabled: false }
  );

  const handleSaveOpenAI = () => {
    if (!openaiApiKey) {
      toast.warning("APIキーを入力してください");
      return;
    }
    saveApiKeys.mutate({ openaiApiKey });
  };

  const handleSaveXApi = () => {
    if (!xBearerToken) {
      toast.warning("Bearer Tokenを入力してください");
      return;
    }
    saveXApiSettings.mutate({ bearerToken: xBearerToken });
  };

  const handleTestOpenAI = () => {
    testOpenAI.refetch();
  };

  const handleTestXApi = () => {
    if (!xBearerToken) {
      toast.warning("Bearer Tokenを入力してください");
      return;
    }
    testXApiConnection.mutate({ bearerToken: xBearerToken });
  };

  if (statusLoading || keysLoading || xApiLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#5C5CFF]" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Page Title - Refined */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#64748B]/10 to-[#475569]/10 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold text-[#1A1D21] tracking-tight">API設定</h1>
            <p className="text-[13px] text-[#6B7280]">
              APIキーの設定と接続テスト
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* OpenAI API Settings */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-[#F8FAFC] to-[#F4F5F7] px-5 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1D21]">OpenAI API</h3>
              {apiStatus?.openai.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#D1FAE5] text-[#047857]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#10B981]" />
                  設定済み
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#EF4444]" />
                  未設定
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#6B7280] mt-1">AI投稿内容生成と戦略作成に使用</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-[13px] font-medium text-[#1A1D21]">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="openai-key"
                    type={showOpenaiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="pr-10 border-[#E5E7EB] text-[13px] rounded-lg focus:ring-2 focus:ring-[#5C5CFF]/20 focus:border-[#5C5CFF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  >
                    {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {!apiStatus?.openai.configured && (
              <div className="p-4 rounded-lg bg-[#FEF3C7]/50 border border-[#FDE68A] text-[12px] text-[#B45309]">
                OpenAI APIキーを設定してください。
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-[#5C5CFF] hover:underline font-medium"
                >
                  APIキーを取得
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleTestOpenAI}
                disabled={!openaiApiKey || testOpenAI.isFetching}
                variant="outline"
                size="sm"
                className="text-[13px] font-medium border-[#E5E7EB] hover:bg-[#F8FAFC] hover:border-[#D1D5DB] rounded-lg transition-all duration-150"
              >
                {testOpenAI.isFetching && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                接続テスト
              </Button>
              <Button
                onClick={handleSaveOpenAI}
                disabled={!openaiApiKey || saveApiKeys.isPending}
                size="sm"
                className="text-[13px] font-medium bg-gradient-to-r from-[#5C5CFF] to-[#4747CC] hover:from-[#4747CC] hover:to-[#3737A8] rounded-lg shadow-sm hover:shadow transition-all duration-150"
              >
                {saveApiKeys.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <Save className="mr-2 h-3.5 w-3.5" />
                保存
              </Button>
            </div>

            {testOpenAI.data && (
              <div className={`p-4 rounded-lg text-[12px] flex items-center gap-2 font-medium ${
                testOpenAI.data.success ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEE2E2] text-[#B91C1C]'
              }`}>
                {testOpenAI.data.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testOpenAI.data.message}
              </div>
            )}
          </div>
        </div>

        {/* X API Settings */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-[#F8FAFC] to-[#F4F5F7] px-5 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1D21]">X (Twitter) API</h3>
              {xApiSettings?.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#D1FAE5] text-[#047857]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#10B981]" />
                  設定済み
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C]">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#EF4444]" />
                  未設定
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#6B7280] mt-1">ツイート取得、ユーザープロフィール取得に使用</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="x-bearer-token" className="text-[13px] font-medium text-[#1A1D21]">Bearer Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="x-bearer-token"
                    type={showXBearerToken ? "text" : "password"}
                    placeholder="AAAA..."
                    value={xBearerToken}
                    onChange={(e) => setXBearerToken(e.target.value)}
                    className="pr-10 border-[#E5E7EB] text-[13px] rounded-lg focus:ring-2 focus:ring-[#5C5CFF]/20 focus:border-[#5C5CFF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowXBearerToken(!showXBearerToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                  >
                    {showXBearerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                X Developer Portalで取得できるBearer Token（App-only認証用）
              </p>
            </div>

            {!xApiSettings?.configured && (
              <div className="p-4 rounded-lg bg-[#FEF3C7]/50 border border-[#FDE68A] text-[12px] text-[#B45309]">
                X API Bearer Tokenを設定してください。
                <a
                  href="https://developer.twitter.com/en/portal/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-[#5C5CFF] hover:underline font-medium"
                >
                  Developer Portalへ
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleTestXApi}
                disabled={!xBearerToken || testXApiConnection.isPending}
                variant="outline"
                size="sm"
                className="text-[13px] font-medium border-[#E5E7EB] hover:bg-[#F8FAFC] hover:border-[#D1D5DB] rounded-lg transition-all duration-150"
              >
                {testXApiConnection.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                接続テスト
              </Button>
              <Button
                onClick={handleSaveXApi}
                disabled={!xBearerToken || saveXApiSettings.isPending}
                size="sm"
                className="text-[13px] font-medium bg-gradient-to-r from-[#5C5CFF] to-[#4747CC] hover:from-[#4747CC] hover:to-[#3737A8] rounded-lg shadow-sm hover:shadow transition-all duration-150"
              >
                {saveXApiSettings.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <Save className="mr-2 h-3.5 w-3.5" />
                保存
              </Button>
            </div>

            {xApiSettings?.lastTestedAt && (
              <p className="text-[11px] text-[#94A3B8]">
                最終テスト: {new Date(xApiSettings.lastTestedAt).toLocaleString('ja-JP')}
                {xApiSettings.testResult && ` (${xApiSettings.testResult})`}
              </p>
            )}
          </div>
        </div>

        {/* API Setup Guide */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-[#F8FAFC] to-[#F4F5F7] px-5 py-4 border-b border-[#E5E7EB]">
            <h3 className="text-[14px] font-semibold text-[#1A1D21]">API設定方法</h3>
          </div>
          <div className="p-5 space-y-5 text-[13px]">
            <div>
              <h4 className="font-semibold text-[#1A1D21] mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-[#D1FAE5] flex items-center justify-center text-[10px] font-bold text-[#047857]">1</span>
                OpenAI API
              </h4>
              <ol className="list-decimal list-inside text-[#64748B] space-y-1.5 ml-7">
                <li><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#5C5CFF] hover:underline font-medium">OpenAI Platform</a>でAPIキーを作成</li>
                <li>上のフォームに入力して「接続テスト」で確認</li>
                <li>「保存」ボタンで設定を保存</li>
              </ol>
            </div>
            <div className="border-t border-[#F3F4F6] pt-5">
              <h4 className="font-semibold text-[#1A1D21] mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-[#DBEAFE] flex items-center justify-center text-[10px] font-bold text-[#1D4ED8]">2</span>
                X (Twitter) API
              </h4>
              <ol className="list-decimal list-inside text-[#64748B] space-y-1.5 ml-7">
                <li><a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#5C5CFF] hover:underline font-medium">X Developer Portal</a>でアプリを作成</li>
                <li>「Keys and tokens」からBearer Tokenを取得</li>
                <li>上のフォームに入力して「接続テスト」で確認</li>
                <li>「保存」ボタンで設定を保存</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
