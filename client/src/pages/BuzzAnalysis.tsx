import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#F59E0B' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">バズ投稿</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{stats?.totalPosts || 0}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">分析済み: {stats?.analyzedPosts || 0}</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#10B981' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">高バイラリティ</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats?.highViralityPosts || 0}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">スコア70以上</p>
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#6366F1' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">平均スコア</p>
            <p className={`text-2xl font-bold mt-0.5 ${getViralityColor(stats?.avgViralityScore || 0)}`}>
              {stats?.avgViralityScore || 0}
            </p>
            <Progress value={stats?.avgViralityScore || 0} className="mt-1" />
          </div>
        </div>
        <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#8B5CF6' } as React.CSSProperties}>
          <div className="pl-3">
            <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">学習パターン</p>
            <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{stats?.totalLearnings || 0}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">アクティブ: {stats?.activeLearnings || 0}</p>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">バズ投稿分析</h2>
          <p className="text-xs text-[#A3A3A3] mt-0.5">バズ投稿を分析してパターンを学習</p>
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
            className="bg-[#D4380D] hover:bg-[#B8300B] text-white"
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

      {/* Main Content */}
      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        {/* Tab Buttons */}
        <div className="flex gap-1 bg-[#F5F5F5] rounded-md p-0.5 w-fit">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === "dashboard" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            ダッシュボード
          </button>
          <button
            onClick={() => setActiveTab("posts")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === "posts" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            投稿一覧 ({stats?.totalPosts || 0})
          </button>
          <button
            onClick={() => setActiveTab("learnings")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === "learnings" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#A3A3A3] hover:text-[#737373]"
            }`}
          >
            学習パターン ({stats?.totalLearnings || 0})
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Source Distribution */}
              <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">ソース別</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#1A1A1A]">自アカウント</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{stats?.ownAccountPosts || 0}</span>
                      <Progress value={stats?.totalPosts ? ((stats.ownAccountPosts || 0) / stats.totalPosts) * 100 : 0} className="w-24" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#1A1A1A]">モデルアカウント</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{stats?.modelAccountPosts || 0}</span>
                      <Progress value={stats?.totalPosts ? ((stats.modelAccountPosts || 0) / stats.totalPosts) * 100 : 0} className="w-24" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">カテゴリ別</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats?.byCategory && Object.entries(stats.byCategory).map(([cat, count]) => (
                    <div key={cat} className="flex justify-between items-center">
                      <span className="text-xs text-[#1A1A1A]">{industryLabels[cat] || cat}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Types */}
              <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">学習タイプ別</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats?.byLearningType && Object.entries(stats.byLearningType).map(([type, count]) => (
                    <div key={type} className="text-center p-4 rounded-lg bg-[#F5F5F5]">
                      <div className="text-2xl font-bold text-[#1A1A1A]">{count}</div>
                      <div className="text-xs text-[#A3A3A3] mt-1">
                        {learningTypeLabels[type] || type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div className="mt-6">
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

            <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
              <div className="grid grid-cols-7 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">
                <div className="px-3 py-2 col-span-2">コンテンツ</div>
                <div className="px-3 py-2">スコア</div>
                <div className="px-3 py-2">カテゴリ</div>
                <div className="px-3 py-2">タイプ</div>
                <div className="px-3 py-2">エンゲージメント</div>
                <div className="px-3 py-2 text-right">ステータス / アクション</div>
              </div>
              {postsLoading ? (
                <div className="px-3 py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : !posts || posts.length === 0 ? (
                <div className="px-3 py-8 text-center text-[#A3A3A3] text-sm">
                  バズ投稿がありません
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="grid grid-cols-7 gap-0 border-t border-[#F0F0F0] hover:bg-[#F5F5F5] transition-colors">
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A] col-span-2">
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
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getViralityBgColor(post.viralityScore || 0)}`} />
                        <span className={`font-bold ${getViralityColor(post.viralityScore || 0)}`}>
                          {post.viralityScore || 0}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      {post.industryCategory ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">
                          {industryLabels[post.industryCategory] || post.industryCategory}
                        </span>
                      ) : (
                        <span className="text-[#A3A3A3] text-sm">-</span>
                      )}
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      {post.postType ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">
                          {postTypeLabels[post.postType] || post.postType}
                        </span>
                      ) : (
                        <span className="text-[#A3A3A3] text-sm">-</span>
                      )}
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <div className="text-sm">
                        <span className="text-red-500">&#9825; {post.likesCount || 0}</span>
                        <span className="mx-1 text-[#A3A3A3]">|</span>
                        <span className="text-blue-500">&#8635; {post.sharesCount || 0}</span>
                        <span className="mx-1 text-[#A3A3A3]">|</span>
                        <span className="text-green-500">&#128172; {post.commentsCount || 0}</span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <div className="flex items-center justify-end gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          post.isAnalyzed === 1
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-[#F5F5F5] text-[#737373]"
                        }`}>
                          {post.isAnalyzed === 1 ? "分析済み" : "未分析"}
                        </span>
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
                                <p className="text-sm bg-[#F5F5F5] p-3 rounded">{post.content}</p>
                              </div>
                              {post.successFactors && (
                                <div>
                                  <h4 className="font-semibold mb-2">成功要因</h4>
                                  <div className="space-y-2">
                                    {JSON.parse(post.successFactors).map((factor: any, i: number) => (
                                      <div key={i} className="bg-[#F5F5F5] p-2 rounded text-sm">
                                        <span className="font-medium">{factor.factor}</span>
                                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                          factor.importance === 'high'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : factor.importance === 'medium'
                                            ? 'bg-[#F5F5F5] text-[#737373]'
                                            : 'border border-[#E5E5E5] text-[#737373]'
                                        }`}>
                                          {factor.importance}
                                        </span>
                                        <p className="text-[#A3A3A3] mt-1">{factor.explanation}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {post.hookAnalysis && (
                                <div>
                                  <h4 className="font-semibold mb-2">フック分析</h4>
                                  <div className="bg-[#F5F5F5] p-3 rounded text-sm">
                                    {(() => {
                                      const hook = JSON.parse(post.hookAnalysis);
                                      return (
                                        <>
                                          <p><span className="font-medium">タイプ:</span> {hook.hookType}</p>
                                          <p><span className="font-medium">テキスト:</span> "{hook.hookText}"</p>
                                          <p><span className="font-medium">効果:</span> {hook.effectiveness}%</p>
                                          <p className="text-[#A3A3A3] mt-1">{hook.analysis}</p>
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Learnings Tab */}
        {activeTab === "learnings" && (
          <div className="mt-6">
            <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
              <div className="grid grid-cols-7 gap-0 bg-[#F5F5F5] text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">
                <div className="px-3 py-2 col-span-2">タイトル</div>
                <div className="px-3 py-2">タイプ</div>
                <div className="px-3 py-2">カテゴリ</div>
                <div className="px-3 py-2">信頼度</div>
                <div className="px-3 py-2">サンプル / 使用</div>
                <div className="px-3 py-2">ステータス</div>
              </div>
              {learningsLoading ? (
                <div className="px-3 py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : !learnings || learnings.length === 0 ? (
                <div className="px-3 py-8 text-center text-[#A3A3A3] text-sm">
                  学習パターンがありません
                </div>
              ) : (
                learnings.map((learning) => (
                  <div key={learning.id} className="grid grid-cols-7 gap-0 border-t border-[#F0F0F0] hover:bg-[#F5F5F5] transition-colors">
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A] col-span-2">
                      <div>
                        <p className="font-medium">{learning.title}</p>
                        <p className="text-[10px] text-[#A3A3A3] line-clamp-1">
                          {learning.description}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">
                        {learningTypeLabels[learning.learningType || ''] || learning.learningType}
                      </span>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      {learning.industryCategory ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">
                          {industryLabels[learning.industryCategory] || learning.industryCategory}
                        </span>
                      ) : (
                        <span className="text-[#A3A3A3]">-</span>
                      )}
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        <Progress value={learning.confidence || 0} className="w-16" />
                        <span className="text-sm">{learning.confidence || 0}%</span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <span>{learning.sampleSize || 0}</span>
                      <span className="text-[#A3A3A3] mx-1">/</span>
                      <span>{learning.usageCount || 0}</span>
                    </div>
                    <div className="px-3 py-2.5 text-xs text-[#1A1A1A]">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer ${
                          learning.isActive === 1
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-[#F5F5F5] text-[#737373]"
                        }`}
                        onClick={() => toggleLearningMutation.mutate({ learningId: learning.id })}
                      >
                        {learning.isActive === 1 ? "アクティブ" : "停止中"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
