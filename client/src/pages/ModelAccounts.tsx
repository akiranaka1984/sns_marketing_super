import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, RefreshCw, Download, Brain, Users, BarChart3, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type IndustryCategory = 'all' | 'it_tech' | 'beauty_fashion' | 'food_restaurant' | 'finance_investment' | 'health_fitness' | 'education' | 'entertainment' | 'travel' | 'business' | 'other';

const industryLabels: Record<string, string> = {
  it_tech: 'IT・テック',
  beauty_fashion: '美容・ファッション',
  food_restaurant: 'フード・レストラン',
  finance_investment: '金融・投資',
  health_fitness: '健康・フィットネス',
  education: '教育',
  entertainment: 'エンタメ',
  travel: '旅行',
  business: 'ビジネス',
  other: 'その他',
};

const postingStyleLabels: Record<string, string> = {
  informative: '情報提供型',
  entertaining: 'エンタメ型',
  educational: '教育型',
  inspirational: 'インスピレーション型',
  promotional: 'プロモーション型',
};

const toneStyleLabels: Record<string, string> = {
  casual: 'カジュアル',
  formal: 'フォーマル',
  humorous: 'ユーモア',
  professional: 'プロフェッショナル',
};

export default function ModelAccounts() {
  const utils = trpc.useUtils();
  const [selectedCategory, setSelectedCategory] = useState<IndustryCategory>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newIndustryCategory, setNewIndustryCategory] = useState<string>("");
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [classifyingId, setClassifyingId] = useState<number | null>(null);

  // Fetch model accounts
  const { data: accounts, isLoading } = trpc.modelAccounts.list.useQuery(
    selectedCategory === 'all' ? {} : { industryCategory: selectedCategory as any }
  );

  // Fetch stats
  const { data: stats } = trpc.modelAccounts.getStats.useQuery();

  // Mutations
  const addMutation = trpc.modelAccounts.add.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("モデルアカウントを追加しました");
        setAddDialogOpen(false);
        setNewUsername("");
        setNewIndustryCategory("");
        utils.modelAccounts.list.invalidate();
        utils.modelAccounts.getStats.invalidate();
      } else {
        toast.error(result.error || "追加に失敗しました");
      }
    },
    onError: (error) => {
      toast.error(`追加失敗: ${error.message}`);
    },
  });

  const fetchProfileMutation = trpc.modelAccounts.fetchProfile.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("プロフィールを更新しました");
        utils.modelAccounts.list.invalidate();
      } else {
        toast.error(result.error || "プロフィール取得に失敗しました");
      }
    },
    onError: (error) => {
      toast.error(`プロフィール取得失敗: ${error.message}`);
    },
  });

  const collectPostsMutation = trpc.modelAccounts.collectPosts.useMutation({
    onSuccess: (result) => {
      setCollectingId(null);
      if (result.success) {
        toast.success(`${result.collected}件の投稿を収集しました`);
        utils.modelAccounts.list.invalidate();
        utils.modelAccounts.getStats.invalidate();
      } else {
        toast.error(result.error || "投稿収集に失敗しました");
      }
    },
    onError: (error) => {
      setCollectingId(null);
      toast.error(`投稿収集失敗: ${error.message}`);
    },
  });

  const collectAllActiveMutation = trpc.modelAccounts.collectAllActive.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`合計${result.totalCollected}件の投稿を収集しました`);
        utils.modelAccounts.list.invalidate();
        utils.modelAccounts.getStats.invalidate();
      }
    },
    onError: (error) => {
      toast.error(`一括収集失敗: ${error.message}`);
    },
  });

  const autoClassifyMutation = trpc.modelAccounts.autoClassify.useMutation({
    onSuccess: (result) => {
      setClassifyingId(null);
      if (result.success) {
        toast.success("AIによる分類が完了しました");
        utils.modelAccounts.list.invalidate();
        utils.modelAccounts.getStats.invalidate();
      } else {
        toast.error(result.error || "分類に失敗しました");
      }
    },
    onError: (error) => {
      setClassifyingId(null);
      toast.error(`分類失敗: ${error.message}`);
    },
  });

  const toggleActiveMutation = trpc.modelAccounts.toggleActive.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      utils.modelAccounts.list.invalidate();
      utils.modelAccounts.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(`ステータス更新失敗: ${error.message}`);
    },
  });

  const deleteMutation = trpc.modelAccounts.delete.useMutation({
    onSuccess: () => {
      toast.success("モデルアカウントを削除しました");
      utils.modelAccounts.list.invalidate();
      utils.modelAccounts.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(`削除失敗: ${error.message}`);
    },
  });

  const handleAdd = () => {
    if (!newUsername.trim()) {
      toast.error("ユーザー名を入力してください");
      return;
    }
    addMutation.mutate({
      platform: "twitter",
      username: newUsername.trim().replace('@', ''),
      industryCategory: newIndustryCategory as any || undefined,
    });
  };

  const handleCollect = (modelAccountId: number) => {
    setCollectingId(modelAccountId);
    collectPostsMutation.mutate({ modelAccountId, maxPosts: 20 });
  };

  const handleAutoClassify = (modelAccountId: number) => {
    setClassifyingId(modelAccountId);
    autoClassifyMutation.mutate({ modelAccountId });
  };

  const handleDelete = (modelAccountId: number) => {
    if (confirm("このモデルアカウントを削除しますか？関連する収集済み投稿も削除されます。")) {
      deleteMutation.mutate({ modelAccountId });
    }
  };

  const categoryCounts = stats?.byCategory || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#6366F1' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">モデルアカウント</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{stats?.totalAccounts || 0}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">アクティブ: {stats?.activeAccounts || 0}</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#10B981' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">収集済み投稿</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{stats?.totalCollectedPosts || 0}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">分析済み: {stats?.analyzedPosts || 0}</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#F59E0B' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">カテゴリ</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{Object.keys(categoryCounts).length}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">業界分類数</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#8B5CF6' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">AI分類</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">GPT-4o</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">自動分類エンジン</p>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">モデルアカウント管理</h2>
          <p className="text-xs text-[#A3A3A3] mt-0.5">バズ投稿を学習するためのモデルアカウント（インフルエンサー・競合）を管理</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => collectAllActiveMutation.mutate()}
            disabled={collectAllActiveMutation.isPending}
          >
            {collectAllActiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            一括収集
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4380D] hover:bg-[#B8300B] text-white">
                <Plus className="h-4 w-4 mr-2" />
                アカウント追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>モデルアカウント追加</DialogTitle>
                <DialogDescription>
                  学習対象のXアカウント（インフルエンサー・競合）を追加します
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Xユーザー名</Label>
                  <Input
                    id="username"
                    placeholder="@username または username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">業界カテゴリ（オプション）</Label>
                  <Select value={newIndustryCategory} onValueChange={setNewIndustryCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(industryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[#A3A3A3]">
                    後からAIで自動分類することもできます
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleAdd} disabled={addMutation.isPending} className="bg-[#D4380D] hover:bg-[#B8300B] text-white">
                  {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  追加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <div className="flex gap-1 bg-[#F5F5F5] rounded-md p-0.5 w-fit">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedCategory === "all" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            すべて ({stats?.totalAccounts || 0})
          </button>
          <button
            onClick={() => setSelectedCategory("it_tech")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedCategory === "it_tech" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            IT・テック ({categoryCounts['it_tech'] || 0})
          </button>
          <button
            onClick={() => setSelectedCategory("business")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedCategory === "business" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            ビジネス ({categoryCounts['business'] || 0})
          </button>
          <button
            onClick={() => setSelectedCategory("entertainment")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedCategory === "entertainment" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            エンタメ ({categoryCounts['entertainment'] || 0})
          </button>
          <button
            onClick={() => setSelectedCategory("education")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedCategory === "education" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            教育 ({categoryCounts['education'] || 0})
          </button>
          <button
            onClick={() => setSelectedCategory("other")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedCategory === "other" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            その他 ({categoryCounts['other'] || 0})
          </button>
        </div>

        {/* Table */}
        <div className="mt-4 border border-[#E5E5E5] rounded-md overflow-hidden">
          <div className="grid grid-cols-8 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">
            <div className="px-3 py-2">ユーザー</div>
            <div className="px-3 py-2">フォロワー</div>
            <div className="px-3 py-2">業界</div>
            <div className="px-3 py-2">投稿スタイル</div>
            <div className="px-3 py-2">トーン</div>
            <div className="px-3 py-2">収集数</div>
            <div className="px-3 py-2">ステータス</div>
            <div className="px-3 py-2 text-right">アクション</div>
          </div>
          {!accounts || accounts.length === 0 ? (
            <div className="px-3 py-8 text-center text-[#A3A3A3] text-sm">
              モデルアカウントがありません
            </div>
          ) : (
            accounts.map((account) => (
              <div key={account.id} className="grid grid-cols-8 gap-0 border-t border-[#F0F0F0] hover:bg-[#F5F5F5] transition-colors">
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">𝕏</span>
                      <span className="font-medium">@{account.username}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(`https://x.com/${account.username}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    {account.displayName && (
                      <span className="text-sm text-[#A3A3A3]">{account.displayName}</span>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  {account.followersCount ? (
                    <span className="font-medium">
                      {account.followersCount.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[#A3A3A3]">-</span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  {account.industryCategory ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">
                      {industryLabels[account.industryCategory] || account.industryCategory}
                    </span>
                  ) : (
                    <span className="text-[#A3A3A3] text-sm">未分類</span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  {account.postingStyle ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">
                      {postingStyleLabels[account.postingStyle] || account.postingStyle}
                    </span>
                  ) : (
                    <span className="text-[#A3A3A3] text-sm">-</span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  {account.toneStyle ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">
                      {toneStyleLabels[account.toneStyle] || account.toneStyle}
                    </span>
                  ) : (
                    <span className="text-[#A3A3A3] text-sm">-</span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  <span className="font-medium">{account.totalCollectedPosts || 0}</span>
                  <span className="text-[#A3A3A3] text-sm ml-1">件</span>
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer ${
                      account.isActive === 1
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[#F5F5F5] text-[#737373]"
                    }`}
                    onClick={() => toggleActiveMutation.mutate({ modelAccountId: account.id })}
                  >
                    {account.isActive === 1 ? "アクティブ" : "停止中"}
                  </span>
                </div>
                <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fetchProfileMutation.mutate({ modelAccountId: account.id })}
                      disabled={fetchProfileMutation.isPending}
                      title="プロフィール更新"
                    >
                      <RefreshCw className={`h-4 w-4 ${fetchProfileMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCollect(account.id)}
                      disabled={collectingId === account.id}
                      title="投稿を収集"
                    >
                      {collectingId === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAutoClassify(account.id)}
                      disabled={classifyingId === account.id}
                      title="AIで自動分類"
                    >
                      {classifyingId === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4 text-[#D4380D]" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(account.id)}
                      disabled={deleteMutation.isPending}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
