import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">モデルアカウント</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAccounts || 0}</div>
            <p className="text-xs text-muted-foreground">
              アクティブ: {stats?.activeAccounts || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">収集済み投稿</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCollectedPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              分析済み: {stats?.analyzedPosts || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">カテゴリ</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(categoryCounts).length}</div>
            <p className="text-xs text-muted-foreground">
              業界分類数
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI分類</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GPT-4o</div>
            <p className="text-xs text-muted-foreground">
              自動分類エンジン
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>モデルアカウント管理</CardTitle>
              <CardDescription>バズ投稿を学習するためのモデルアカウント（インフルエンサー・競合）を管理</CardDescription>
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
                  <Button>
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
                      <p className="text-xs text-muted-foreground">
                        後からAIで自動分類することもできます
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      キャンセル
                    </Button>
                    <Button onClick={handleAdd} disabled={addMutation.isPending}>
                      {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      追加
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as IndustryCategory)}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">
                すべて ({stats?.totalAccounts || 0})
              </TabsTrigger>
              <TabsTrigger value="it_tech">
                IT・テック ({categoryCounts['it_tech'] || 0})
              </TabsTrigger>
              <TabsTrigger value="business">
                ビジネス ({categoryCounts['business'] || 0})
              </TabsTrigger>
              <TabsTrigger value="entertainment">
                エンタメ ({categoryCounts['entertainment'] || 0})
              </TabsTrigger>
              <TabsTrigger value="education">
                教育 ({categoryCounts['education'] || 0})
              </TabsTrigger>
              <TabsTrigger value="other">
                その他 ({categoryCounts['other'] || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ユーザー</TableHead>
                      <TableHead>フォロワー</TableHead>
                      <TableHead>業界</TableHead>
                      <TableHead>投稿スタイル</TableHead>
                      <TableHead>トーン</TableHead>
                      <TableHead>収集数</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!accounts || accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          モデルアカウントがありません
                        </TableCell>
                      </TableRow>
                    ) : (
                      accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
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
                                <span className="text-sm text-muted-foreground">{account.displayName}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {account.followersCount ? (
                              <span className="font-medium">
                                {account.followersCount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.industryCategory ? (
                              <Badge variant="outline">
                                {industryLabels[account.industryCategory] || account.industryCategory}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">未分類</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.postingStyle ? (
                              <Badge variant="secondary">
                                {postingStyleLabels[account.postingStyle] || account.postingStyle}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.toneStyle ? (
                              <Badge variant="secondary">
                                {toneStyleLabels[account.toneStyle] || account.toneStyle}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{account.totalCollectedPosts || 0}</span>
                            <span className="text-muted-foreground text-sm ml-1">件</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={account.isActive === 1 ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => toggleActiveMutation.mutate({ modelAccountId: account.id })}
                            >
                              {account.isActive === 1 ? "アクティブ" : "停止中"}
                            </Badge>
                          </TableCell>
                          <TableCell>
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
                                  <Brain className="h-4 w-4 text-purple-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(account.id)}
                                disabled={deleteMutation.isPending}
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
