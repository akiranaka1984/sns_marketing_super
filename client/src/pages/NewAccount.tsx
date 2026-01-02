import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function NewAccount() {
  const [, setLocation] = useLocation();
  const [platform, setPlatform] = useState<'twitter' | 'tiktok' | 'instagram' | 'facebook'>('twitter');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [autoRegister, setAutoRegister] = useState(true);

  const utils = trpc.useUtils();
  
  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: async (result) => {
      toast.success("アカウントを作成しました");
      
      if (autoRegister && result.id) {
        toast.info("自動登録を開始しています...");
        try {
          const registerResult = await registerMutation.mutateAsync({ accountId: result.id });
          if (registerResult.success) {
            toast.success("アカウントの登録が完了しました");
          } else {
            toast.error(`登録に失敗しました: ${registerResult.error}`);
          }
        } catch (error) {
          toast.error("登録に失敗しました");
        }
      }
      
      utils.accounts.list.invalidate();
      setLocation('/accounts');
    },
    onError: (error: any) => {
      // Check if this is a duplicate account error
      if (error.data?.code === 'CONFLICT' && error.data?.cause?.accountId) {
        const accountId = error.data.cause.accountId;
        toast.error(
          `このアカウントは既に存在します。`,
          {
            action: {
              label: '詳細を見る',
              onClick: () => setLocation(`/accounts/${accountId}`)
            },
            duration: 5000
          }
        );
      } else {
        toast.error(`アカウントの作成に失敗しました: ${error.message}`);
      }
    },
  });

  const registerMutation = trpc.accounts.register.useMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error("すべての項目を入力してください");
      return;
    }

    createMutation.mutate({
      platform,
      username,
      password,
    });
  };

  const isLoading = createMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">新規アカウント追加</h1>
            <p className="text-slate-600">
              SNSアカウントの認証情報を入力して追加します
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>アカウント情報</CardTitle>
              <CardDescription>
                認証情報は安全に保存され、自動登録にのみ使用されます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="platform">プラットフォーム</Label>
                  <Select
                    value={platform}
                    onValueChange={(value) => setPlatform(value as typeof platform)}
                  >
                    <SelectTrigger id="platform">
                      <SelectValue placeholder="プラットフォームを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twitter">𝕏 Twitter</SelectItem>
                      <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                      <SelectItem value="instagram">📷 Instagram</SelectItem>
                      <SelectItem value="facebook">👥 Facebook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">ユーザー名またはメールアドレス</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="ユーザー名またはメールアドレスを入力"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="パスワードを入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoRegister"
                    checked={autoRegister}
                    onChange={(e) => setAutoRegister(e.target.checked)}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Label htmlFor="autoRegister" className="text-sm font-normal">
                    作成後に自動でアカウント登録を実行する
                  </Label>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setLocation('/accounts')}
                    disabled={isLoading}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {registerMutation.isPending ? '登録中...' : '作成中...'}
                      </>
                    ) : (
                      'アカウントを追加'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">ご利用の流れ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-slate-900">認証情報を入力</p>
                  <p>SNSプラットフォームのユーザー名/メールアドレスとパスワードを入力します</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-slate-900">自動登録</p>
                  <p>クラウドデバイスを使用して自動的にアカウントにログインします</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-slate-900">管理開始</p>
                  <p>登録完了後、アカウントの管理やマーケティング戦略の生成が可能になります</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
