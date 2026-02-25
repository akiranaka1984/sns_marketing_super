import { Button } from "@/components/ui/button";
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

  const utils = trpc.useUtils();

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: async () => {
      toast.success("アカウントを作成しました");
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

  const isLoading = createMutation.isPending;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="fade-in-up">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A1A]">新規アカウント追加</h1>
          <p className="text-sm text-[#6B6B6B] font-bold mt-1">SNSアカウントの認証情報を入力して追加します</p>
        </div>
      </div>

      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-1">アカウント情報</h3>
        <p className="text-xs text-[#6B6B6B] font-bold mb-3">認証情報は安全に保存され、自動登録にのみ使用されます</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="platform" className="text-sm font-bold text-[#1A1A1A]">プラットフォーム</Label>
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as typeof platform)}
            >
              <SelectTrigger id="platform" className="border-2 border-[#1A1A1A] bg-[#FFFDF7] rounded-lg font-bold">
                <SelectValue placeholder="プラットフォームを選択" />
              </SelectTrigger>
              <SelectContent className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
                <SelectItem value="twitter">𝕏 Twitter</SelectItem>
                <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                <SelectItem value="instagram">📷 Instagram</SelectItem>
                <SelectItem value="facebook">👥 Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-bold text-[#1A1A1A]">ユーザー名またはメールアドレス</Label>
            <Input
              id="username"
              type="text"
              placeholder="ユーザー名またはメールアドレスを入力"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="border-2 border-[#1A1A1A] bg-[#FFFDF7] rounded-lg font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-bold text-[#1A1A1A]">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="border-2 border-[#1A1A1A] bg-[#FFFDF7] rounded-lg font-bold"
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-2 border-[#1A1A1A] text-[#1A1A1A] font-bold bg-[#FFFDF7] hover:bg-[#FFF8DC] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] rounded-lg"
              onClick={() => setLocation('/accounts')}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2 bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] font-bold border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  作成中...
                </>
              ) : (
                'アカウントを追加'
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-1">ご利用の流れ</h3>
        <div className="space-y-3 text-sm font-bold text-[#6B6B6B] mt-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#FFD700] text-[#1A1A1A] flex items-center justify-center font-bold border-2 border-[#1A1A1A]">
              1
            </div>
            <div>
              <p className="font-bold text-[#1A1A1A]">認証情報を入力</p>
              <p>SNSプラットフォームのユーザー名/メールアドレスとパスワードを入力します</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#4ECDC4] text-[#1A1A1A] flex items-center justify-center font-bold border-2 border-[#1A1A1A]">
              2
            </div>
            <div>
              <p className="font-bold text-[#1A1A1A]">デバイスを割り当て</p>
              <p>アカウント詳細画面からクラウドデバイスを割り当て、手動でログインします</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#A8E6CF] text-[#1A1A1A] flex items-center justify-center font-bold border-2 border-[#1A1A1A]">
              3
            </div>
            <div>
              <p className="font-bold text-[#1A1A1A]">管理開始</p>
              <p>ログイン完了後、アカウントの管理やマーケティング戦略の生成が可能になります</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
