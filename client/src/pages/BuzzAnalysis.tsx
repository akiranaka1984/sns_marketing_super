import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Brain, Zap, TrendingUp, BarChart3, Lightbulb, ExternalLink, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";

type TabValue = 'posts' | 'learnings' | 'dashboard';

const industryLabels: Record<string, string> = {
  it_tech: 'IT・テック',
  beauty_fashion: '美容・ファッション',
  food_restaurant: 'フード',
  finance_investment: '金融・投資',
  health_fitness: '健康・フィットネス',
  education: '教育',
  entertainment: 'エンタメ',
  travel: '旅行',
  business: 'ビジネス',
  other: 'その他',
  uncategorized: '未分類',
};

const postTypeLabels: Record<string, string> = {
  announcement: 'お知らせ',
  empathy: '共感',
  educational: '教育的',
  humor: 'ユーモア',
  promotional: 'プロモーション',
  question: '質問',
  other: 'その他',
};

const learningTypeLabels: Record<string, string> = {
  hook_pattern: 'フック（冒頭）パターン',
  structure_pattern: '構成パターン',
  hashtag_strategy: 'ハッシュタグ戦略',
  timing_pattern: 'タイミングパターン',
  cta_pattern: 'CTA（行動喚起）パターン',
  media_usage: 'メディア活用',
  tone_pattern: 'トーンパターン',
};

const getViralityColor = (score: number) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
};

const getViralityBgColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

export default function BuzzAnalysis() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = trpc.buzzAnalysis.getDashboardStats.useQuery();

  // Fetch buzz posts
  const { data: posts, isLoading: postsLoading } = trpc.buzzAnalysis.listBuzzPosts.useQuery({
    industryCategory: selectedCategory !== 'all' ? selectedCategory as any : undefined,
    limit: 50,
  });

  // Fetch learnings
  const { data: learnings, isLoading: learningsLoading } = trpc.buzzAnalysis.listLearnings.useQuery({
    limit: 50,
  });

  // Mutations
  const analyzeMutation = trpc.buzzAnalysis.analyzeBuzzPost.useMutation({
    onSuccess: (result) => {
      setAnalyzingId(null);
      if (result.success) {
        toast.success("分析が完了しました");
        utils.buzzAnalysis.listBuzzPosts.invalidate();
        utils.buzzAnalysis.getDashboardStats.invalidate();
      } else {
        toast.error(result.error || "分析に失敗しました");
      }
    },
    onError: (error) => {
      setAnalyzingId(null);
      toast.error(`分析失敗: ${error.message}`);
    },
  });

  const batchAnalyzeMutation = trpc.buzzAnalysis.batchAnalyze.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.analyzed}件の投稿を分析しました`);
        utils.buzzAnalysis.listBuzzPosts.invalidate();
        utils.buzzAnalysis.getDashboardStats.invalidate();
      }
    },
    onError: (error) => {
      toast.error(`一括分析失敗: ${error.message}`);
    },
  });

  const extractPatternsMutation = trpc.buzzAnalysis.extractPatterns.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        const autoApplied = (result as any).autoApplied;
        if (autoApplied && autoApplied.appliedCount > 0) {
          toast.success(
            `${result.patterns.length}件のパターンを抽出し、全アカウントに自動適用しました（${autoApplied.appliedCount}件）`,
            { duration: 5000 }
          );
        } else {
          toast.success(`${result.patterns.length}件のパターンを抽出しました`);
        }
        utils.buzzAnalysis.listLearnings.invalidate();
        utils.buzzAnalysis.getDashboardStats.invalidate();
      } else {
        toast.error(result.error || "パターン抽出に失敗しました");
      }
    },
    onError: (error) => {
      toast.error(`パターン抽出失敗: ${error.message}`);
    },
  });

  const toggleLearningMutation = trpc.buzzAnalysis.toggleLearningActive.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      utils.buzzAnalysis.listLearnings.invalidate();
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const handleAnalyze = (postId: number) => {
    setAnalyzingId(postId);
    analyzeMutation.mutate({ buzzPostId: postId });
  };

  if (statsLoading) {
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
            <CardTitle className="text-sm font-medium">バズ投稿</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              分析済み: {stats?.analyzedPosts || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">高バイラリティ</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.highViralityPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              スコア70以上
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均スコア</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getViralityColor(stats?.avgViralityScore || 0)}`}>
              {stats?.avgViralityScore || 0}
            </div>
            <Progress value={stats?.avgViralityScore || 0} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">学習パターン</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLearnings || 0}</div>
            <p className="text-xs text-muted-foreground">
              アクティブ: {stats?.activeLearnings || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>バズ投稿分析</CardTitle>
              <CardDescription>バズ投稿を分析してパターンを学習</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => batchAnalyzeMutation.mutate({ limit: 10 })}
                disabled={batchAnalyzeMutation.isPending}
              >
                {batchAnalyzeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                一括分析
              </Button>
              <Button
                onClick={() => extractPatternsMutation.mutate({ minViralityScore: 50, minPosts: 5 })}
                disabled={extractPatternsMutation.isPending}
              >
                {extractPatternsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                パターン抽出
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard">ダッシュボード</TabsTrigger>
              <TabsTrigger value="posts">投稿一覧 ({stats?.totalPosts || 0})</TabsTrigger>
              <TabsTrigger value="learnings">学習パターン ({stats?.totalLearnings || 0})</TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Source Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">ソース別</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>自アカウント</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{stats?.ownAccountPosts || 0}</span>
                          <Progress value={stats?.totalPosts ? ((stats.ownAccountPosts || 0) / stats.totalPosts) * 100 : 0} className="w-24" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>モデルアカウント</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{stats?.modelAccountPosts || 0}</span>
                          <Progress value={stats?.totalPosts ? ((stats.modelAccountPosts || 0) / stats.totalPosts) * 100 : 0} className="w-24" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Category Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">カテゴリ別</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {stats?.byCategory && Object.entries(stats.byCategory).map(([cat, count]) => (
                        <div key={cat} className="flex justify-between items-center">
                          <span className="text-sm">{industryLabels[cat] || cat}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Learning Types */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">学習タイプ別</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stats?.byLearningType && Object.entries(stats.byLearningType).map(([type, count]) => (
                        <div key={type} className="text-center p-4 rounded-lg bg-muted">
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {learningTypeLabels[type] || type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Posts Tab */}
            <TabsContent value="posts" className="mt-6">
              <div className="mb-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="カテゴリでフィルター" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {Object.entries(industryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">コンテンツ</TableHead>
                      <TableHead>スコア</TableHead>
                      <TableHead>カテゴリ</TableHead>
                      <TableHead>タイプ</TableHead>
                      <TableHead>エンゲージメント</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : !posts || posts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          バズ投稿がありません
                        </TableCell>
                      </TableRow>
                    ) : (
                      posts.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <p className="text-sm line-clamp-2">{post.content}</p>
                              {post.postUrl && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto text-xs"
                                  onClick={() => window.open(post.postUrl || '', '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  元投稿を見る
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getViralityBgColor(post.viralityScore || 0)}`} />
                              <span className={`font-bold ${getViralityColor(post.viralityScore || 0)}`}>
                                {post.viralityScore || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {post.industryCategory ? (
                              <Badge variant="outline">
                                {industryLabels[post.industryCategory] || post.industryCategory}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {post.postType ? (
                              <Badge variant="secondary">
                                {postTypeLabels[post.postType] || post.postType}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="text-red-500">♡ {post.likesCount || 0}</span>
                              <span className="mx-1 text-muted-foreground">|</span>
                              <span className="text-blue-500">↻ {post.sharesCount || 0}</span>
                              <span className="mx-1 text-muted-foreground">|</span>
                              <span className="text-green-500">💬 {post.commentsCount || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={post.isAnalyzed === 1 ? "default" : "secondary"}>
                              {post.isAnalyzed === 1 ? "分析済み" : "未分析"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedPost(post)}
                                  >
                                    詳細
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>投稿分析詳細</DialogTitle>
                                    <DialogDescription>
                                      バイラリティスコア: {post.viralityScore || 0}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                                    <div>
                                      <h4 className="font-semibold mb-2">コンテンツ</h4>
                                      <p className="text-sm bg-muted p-3 rounded">{post.content}</p>
                                    </div>
                                    {post.successFactors && (
                                      <div>
                                        <h4 className="font-semibold mb-2">成功要因</h4>
                                        <div className="space-y-2">
                                          {JSON.parse(post.successFactors).map((factor: any, i: number) => (
                                            <div key={i} className="bg-muted p-2 rounded text-sm">
                                              <span className="font-medium">{factor.factor}</span>
                                              <Badge className="ml-2" variant={
                                                factor.importance === 'high' ? 'default' :
                                                factor.importance === 'medium' ? 'secondary' : 'outline'
                                              }>
                                                {factor.importance}
                                              </Badge>
                                              <p className="text-muted-foreground mt-1">{factor.explanation}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {post.hookAnalysis && (
                                      <div>
                                        <h4 className="font-semibold mb-2">フック分析</h4>
                                        <div className="bg-muted p-3 rounded text-sm">
                                          {(() => {
                                            const hook = JSON.parse(post.hookAnalysis);
                                            return (
                                              <>
                                                <p><span className="font-medium">タイプ:</span> {hook.hookType}</p>
                                                <p><span className="font-medium">テキスト:</span> "{hook.hookText}"</p>
                                                <p><span className="font-medium">効果:</span> {hook.effectiveness}%</p>
                                                <p className="text-muted-foreground mt-1">{hook.analysis}</p>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              {post.isAnalyzed !== 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAnalyze(post.id)}
                                  disabled={analyzingId === post.id}
                                >
                                  {analyzingId === post.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Learnings Tab */}
            <TabsContent value="learnings" className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>タイプ</TableHead>
                      <TableHead>カテゴリ</TableHead>
                      <TableHead>信頼度</TableHead>
                      <TableHead>サンプル数</TableHead>
                      <TableHead>使用回数</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learningsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : !learnings || learnings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          学習パターンがありません
                        </TableCell>
                      </TableRow>
                    ) : (
                      learnings.map((learning) => (
                        <TableRow key={learning.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{learning.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {learning.description}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {learningTypeLabels[learning.learningType || ''] || learning.learningType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {learning.industryCategory ? (
                              <Badge variant="secondary">
                                {industryLabels[learning.industryCategory] || learning.industryCategory}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={learning.confidence || 0} className="w-16" />
                              <span className="text-sm">{learning.confidence || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{learning.sampleSize || 0}</TableCell>
                          <TableCell>{learning.usageCount || 0}</TableCell>
                          <TableCell>
                            <Badge
                              variant={learning.isActive === 1 ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => toggleLearningMutation.mutate({ learningId: learning.id })}
                            >
                              {learning.isActive === 1 ? "アクティブ" : "停止中"}
                            </Badge>
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
