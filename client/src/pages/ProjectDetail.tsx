import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Calendar, Target, Users, FileText, Plus, Play, Pause, CheckCircle, Edit, Bot, Sparkles, Loader2, Trash2, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import ProjectInteractions from "@/components/ProjectInteractions";
// ProjectModelAccounts removed - now managed at account level
import { Settings, Zap, Eye, Hand } from "lucide-react";
import ExecutionModeSelector from "@/components/ExecutionModeSelector";
import KPIProgressCard from "@/components/KPIProgressCard";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postScheduledTime, setPostScheduledTime] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<number | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPostAccountId, setSelectedPostAccountId] = useState<number | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);

  const { data: project, isLoading } = trpc.projects.byId.useQuery({ id: projectId });
  const { data: allAccounts } = trpc.accounts.list.useQuery();
  const { data: agents } = trpc.agents.list.useQuery();
  const utils = trpc.useUtils();
  
  const addAccountMutation = trpc.projects.addAccount.useMutation({
    onSuccess: () => {
      toast.success("アカウントをプロジェクトに追加しました");
      setIsAddAccountDialogOpen(false);
      setSelectedAccountId(null);
      utils.projects.byId.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleAddAccount = () => {
    if (!selectedAccountId) {
      toast.error("アカウントを選択してください");
      return;
    }
    addAccountMutation.mutate({
      projectId,
      accountId: selectedAccountId,
    });
  };

  const generateMutation = trpc.scheduledPosts.generateWithAgent.useMutation({
    onSuccess: (data) => {
      const hashtagsText = data.hashtags?.length > 0 ? '\n\n' + data.hashtags.map((h: string) => `#${h}`).join(' ') : '';
      setPostContent(data.content + hashtagsText);
      toast.success(`「${data.agentName}」が投稿内容を生成しました`);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(`生成エラー: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const createPostMutation = trpc.projects.createPost.useMutation({
    onSuccess: () => {
      toast.success("投稿を作成しました");
      setIsCreatePostDialogOpen(false);
      setPostContent("");
      setPostScheduledTime("");
      setSelectedAgent(undefined);
      setSelectedPostAccountId(null);
      utils.projects.byId.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deletePostMutation = trpc.scheduledPosts.delete.useMutation({
    onSuccess: () => {
      toast.success("投稿を削除しました");
      utils.projects.byId.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  const handleDeletePost = (postId: number) => {
    if (window.confirm("この投稿を削除しますか？")) {
      deletePostMutation.mutate({ id: postId });
    }
  };

  const publishNowMutation = trpc.scheduledPosts.publishNow.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("投稿を公開しました");
      } else {
        toast.error(`公開失敗: ${result.message}`);
      }
      utils.projects.byId.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handlePublishNow = (postId: number) => {
    if (window.confirm("この投稿を今すぐ公開しますか？")) {
      publishNowMutation.mutate({ id: postId });
    }
  };

  // Data-integrated strategy generation mutation
  const generateStrategyMutation = trpc.projects.generateStrategyWithContext.useMutation({
    onSuccess: (result) => {
      toast.success(`データ統合戦略を生成しました（ID: ${result.strategyId}）`);
      setIsGeneratingStrategy(false);
      utils.projects.byId.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(`戦略生成エラー: ${error.message}`);
      setIsGeneratingStrategy(false);
    },
  });

  const handleGenerateStrategy = () => {
    setIsGeneratingStrategy(true);
    generateStrategyMutation.mutate({
      projectId,
      minBuzzConfidence: 50,
      maxBuzzLearnings: 10,
      maxModelPatterns: 5,
    });
  };

  const handleGenerateContent = () => {
    if (!selectedAgent) {
      toast.error("エージェントを選択してください");
      return;
    }
    if (!project?.accounts || project.accounts.length === 0) {
      toast.error("プロジェクトにアカウントを追加してください");
      return;
    }
    const accountId = selectedPostAccountId || project.accounts[0].accountId;
    setIsGenerating(true);
    generateMutation.mutate({
      agentId: selectedAgent,
      accountId: accountId,
    });
  };

  const handleCreatePost = () => {
    if (!postContent.trim()) {
      toast.error("投稿内容を入力してください");
      return;
    }
    if (!postScheduledTime) {
      toast.error("投稿予定日時を選択してください");
      return;
    }
    if (!project?.accounts || project.accounts.length === 0) {
      toast.error("プロジェクトにアカウントを追加してください");
      return;
    }
    if (!selectedPostAccountId) {
      toast.error("投稿するアカウントを選択してください");
      return;
    }
    createPostMutation.mutate({
      projectId,
      accountId: selectedPostAccountId,
      content: postContent,
      scheduledAt: postScheduledTime,
    });
  };

  // Filter out accounts already added to the project
  const availableAccounts = allAccounts?.filter(
    (account) => !project?.accounts?.some((pa) => pa.accountId === account.id)
  ) || [];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "下書き", variant: "secondary" as const, icon: null },
      active: { label: "実行中", variant: "default" as const, icon: <Play className="h-3 w-3" /> },
      paused: { label: "一時停止", variant: "outline" as const, icon: <Pause className="h-3 w-3" /> },
      completed: { label: "完了", variant: "outline" as const, icon: <CheckCircle className="h-3 w-3" /> },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "未設定";
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">プロジェクトが見つかりません</h2>
          <p className="text-slate-600 mb-6">指定されたプロジェクトは存在しないか、削除されました</p>
          <Button onClick={() => setLocation("/projects")}>
            プロジェクト一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation("/projects")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          プロジェクト一覧に戻る
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-slate-600">{project.objective}</p>
            {project.description && (
              <p className="text-slate-500 mt-2">{project.description}</p>
            )}
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setLocation(`/projects/${projectId}/edit`)}>
            <Edit className="h-4 w-4" />
            編集
          </Button>
        </div>
      </div>

      {/* Execution Mode Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-600" />
              <CardTitle>実行モード</CardTitle>
            </div>
          </div>
          <CardDescription>
            プロジェクトの投稿承認フローを設定します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExecutionModeSelector projectId={projectId} currentMode={project.executionMode || 'confirm'} />
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">期間</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatDate(project.startDate)} 〜 {formatDate(project.endDate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">アカウント数</p>
                <p className="text-lg font-semibold text-slate-900">
                  {project.accounts?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">投稿数</p>
                <p className="text-lg font-semibold text-slate-900">
                  {project.posts?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">目標</p>
                <p className="text-lg font-semibold text-slate-900">
                  {(() => {
                    if (!project.targets) return "未設定";
                    try {
                      const targets = JSON.parse(project.targets);
                      const entries = Object.entries(targets);
                      if (entries.length === 0) return "未設定";
                      return entries.map(([key, value]) => 
                        `${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`
                      ).join(" / ");
                    } catch (e) {
                      return "未設定";
                    }
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Progress */}
      {project.targets && (
        <div className="mb-8">
          <KPIProgressCard
            targets={(() => {
              try {
                return JSON.parse(project.targets);
              } catch {
                return null;
              }
            })()}
            currentMetrics={{
              followers: 0,
              engagement: 0,
              clicks: 0,
              conversions: 0,
            }}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="accounts">アカウント</TabsTrigger>
          <TabsTrigger value="strategies">戦略</TabsTrigger>
          <TabsTrigger value="posts">投稿</TabsTrigger>
          <TabsTrigger value="interactions">相互連携</TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>プロジェクトアカウント</CardTitle>
                  <CardDescription>このプロジェクトで使用するSNSアカウント</CardDescription>
                </div>
                <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      アカウント追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>アカウントを追加</DialogTitle>
                      <DialogDescription>
                        プロジェクトに追加するアカウントを選択してください
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {availableAccounts.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-slate-600 mb-4">追加可能なアカウントがありません</p>
                          <Button variant="outline" onClick={() => setLocation("/accounts/new")}>
                            新しいアカウントを作成
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {availableAccounts.map((account) => (
                              <div
                                key={account.id}
                                onClick={() => setSelectedAccountId(account.id)}
                                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                  selectedAccountId === account.id
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-slate-900">{account.username}</p>
                                    {account.xHandle && (
                                      <p className="text-sm text-slate-600">@{account.xHandle}</p>
                                    )}
                                  </div>
                                  <Badge variant="outline">{account.platform}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsAddAccountDialogOpen(false);
                                setSelectedAccountId(null);
                              }}
                            >
                              キャンセル
                            </Button>
                            <Button
                              onClick={handleAddAccount}
                              disabled={!selectedAccountId || addAccountMutation.isPending}
                            >
                              {addAccountMutation.isPending ? "追加中..." : "追加"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!project.accounts || project.accounts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">まだアカウントが追加されていません</p>
                  <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">アカウントを追加</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>アカウントを追加</DialogTitle>
                        <DialogDescription>
                          プロジェクトに追加するアカウントを選択してください
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {availableAccounts.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-slate-600 mb-4">追加可能なアカウントがありません</p>
                            <Button variant="outline" onClick={() => setLocation("/accounts/new")}>
                              新しいアカウントを作成
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {availableAccounts.map((account) => (
                                <div
                                  key={account.id}
                                  onClick={() => setSelectedAccountId(account.id)}
                                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                    selectedAccountId === account.id
                                      ? "border-blue-500 bg-blue-50"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-slate-900">{account.username}</p>
                                      {account.xHandle && (
                                        <p className="text-sm text-slate-600">@{account.xHandle}</p>
                                      )}
                                    </div>
                                    <Badge variant="outline">{account.platform}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsAddAccountDialogOpen(false);
                                  setSelectedAccountId(null);
                                }}
                              >
                                キャンセル
                              </Button>
                              <Button
                                onClick={handleAddAccount}
                                disabled={!selectedAccountId || addAccountMutation.isPending}
                              >
                                {addAccountMutation.isPending ? "追加中..." : "追加"}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.accounts.map((pa) => (
                    <div key={pa.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {pa.account?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{pa.account?.username}</p>
                          <p className="text-sm text-slate-500">
                            Lv.{pa.account?.level || 1} • {pa.account?.experiencePoints || 0} XP
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{pa.account?.platform}</Badge>
                        <Link href={`/accounts/${pa.accountId}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            詳細・設定
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategies Tab */}
        <TabsContent value="strategies">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>マーケティング戦略</CardTitle>
                  <CardDescription>このプロジェクトに紐づく戦略</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={handleGenerateStrategy}
                    disabled={isGeneratingStrategy}
                  >
                    {isGeneratingStrategy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isGeneratingStrategy ? "生成中..." : "データ統合戦略を生成"}
                  </Button>
                  <Link href="/strategies/new">
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      基本戦略を生成
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!project.strategies || project.strategies.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">まだ戦略が生成されていません</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={handleGenerateStrategy} disabled={isGeneratingStrategy}>
                      {isGeneratingStrategy ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {isGeneratingStrategy ? "生成中..." : "データ統合戦略を生成"}
                    </Button>
                    <Link href="/strategies/new">
                      <Button variant="outline">基本戦略を生成</Button>
                    </Link>
                  </div>
                  <p className="text-xs text-slate-400 mt-4">
                    ※データ統合戦略：バズ分析データとモデルアカウントの学習を活用して戦略を生成します
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.strategies.map((strategy: any) => (
                    <div key={strategy.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 mb-1">{strategy.objective}</p>
                          <p className="text-sm text-slate-600">{strategy.contentType}</p>
                        </div>
                        {(strategy.incorporatedBuzzLearnings || strategy.incorporatedModelPatterns) && (
                          <Badge variant="secondary" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            データ統合
                          </Badge>
                        )}
                      </div>
                      {strategy.timingGuidelines && (
                        <div className="mt-2 text-xs text-slate-500">
                          {(() => {
                            try {
                              const timing = JSON.parse(strategy.timingGuidelines);
                              return `推奨時間帯: ${timing.bestHours?.join(', ')}時 / ${timing.frequency}`;
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>投稿スケジュール</CardTitle>
                  <CardDescription>予定されている投稿と実績</CardDescription>
                </div>
                <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      投稿を作成
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>投稿を作成</DialogTitle>
                      <DialogDescription>
                        新しい投稿をスケジュールします
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">投稿するアカウント</label>
                        <Select
                          value={selectedPostAccountId?.toString() || ""}
                          onValueChange={(value) => setSelectedPostAccountId(value ? parseInt(value) : null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="アカウントを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {project?.accounts?.map((pa) => (
                              <SelectItem key={pa.accountId} value={pa.accountId.toString()}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{pa.account?.username}</span>
                                  {pa.account?.xHandle && (
                                    <span className="text-muted-foreground text-xs">@{pa.account.xHandle}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">エージェント（AI自動生成）</label>
                        <div className="flex gap-2">
                          <Select
                            value={selectedAgent?.toString()}
                            onValueChange={(value) => setSelectedAgent(value ? parseInt(value) : undefined)}
                          >
                            <SelectTrigger className="flex-1 min-w-0">
                              <SelectValue placeholder="エージェントを選択（任意）" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-4rem)]">
                              {agents?.map((agent: any) => (
                                <SelectItem key={agent.id} value={agent.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-primary" />
                                    <span className="font-medium">{agent.name}</span>
                                    <span className="text-muted-foreground text-xs">- {agent.theme}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleGenerateContent}
                            disabled={!selectedAgent || isGenerating}
                            className="flex-shrink-0"
                          >
                            {isGenerating ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            {isGenerating ? "生成中..." : "AI生成"}
                          </Button>
                        </div>
                        {selectedAgent && agents && (
                          <p className="text-xs text-muted-foreground">
                            選択したエージェントのスタイルで投稿内容を自動生成します
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">投稿内容</label>
                        <textarea
                          className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="投稿内容を入力、またはエージェントでAI生成..."
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">投稿予定日時</label>
                        <input
                          type="datetime-local"
                          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={postScheduledTime}
                          onChange={(e) => setPostScheduledTime(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsCreatePostDialogOpen(false)}>
                          キャンセル
                        </Button>
                        <Button onClick={handleCreatePost} disabled={createPostMutation.isPending}>
                          {createPostMutation.isPending ? "作成中..." : "作成"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!project.posts || project.posts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">まだ投稿が作成されていません</p>
                  <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">投稿を作成</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>投稿を作成</DialogTitle>
                        <DialogDescription>
                          新しい投稿をスケジュールします
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900">投稿するアカウント</label>
                          <Select
                            value={selectedPostAccountId?.toString() || ""}
                            onValueChange={(value) => setSelectedPostAccountId(value ? parseInt(value) : null)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="アカウントを選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {project?.accounts?.map((pa) => (
                                <SelectItem key={pa.accountId} value={pa.accountId.toString()}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{pa.account?.username}</span>
                                    {pa.account?.xHandle && (
                                      <span className="text-muted-foreground text-xs">@{pa.account.xHandle}</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900">エージェント（AI自動生成）</label>
                          <div className="flex gap-2">
                            <Select
                              value={selectedAgent?.toString()}
                              onValueChange={(value) => setSelectedAgent(value ? parseInt(value) : undefined)}
                            >
                              <SelectTrigger className="flex-1 min-w-0 max-w-full">
                                <SelectValue placeholder="エージェントを選択（任意）" />
                              </SelectTrigger>
                              <SelectContent className="max-w-[calc(100vw-4rem)]">
                                {agents?.map((agent: any) => (
                                  <SelectItem key={agent.id} value={agent.id.toString()}>
                                    <div className="flex items-center gap-2">
                                      <Bot className="h-4 w-4 text-primary" />
                                      <span className="font-medium">{agent.name}</span>
                                      <span className="text-muted-foreground text-xs">- {agent.theme}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleGenerateContent}
                              disabled={!selectedAgent || isGenerating}
                              className="flex-shrink-0"
                            >
                              {isGenerating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                              )}
                              {isGenerating ? "生成中..." : "AI生成"}
                            </Button>
                          </div>
                          {selectedAgent && agents && (
                            <p className="text-xs text-muted-foreground">
                              選択したエージェントのスタイルで投稿内容を自動生成します
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900">投稿内容</label>
                          <textarea
                            className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="投稿内容を入力、またはエージェントでAI生成..."
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-900">投稿予定日時</label>
                          <input
                            type="datetime-local"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={postScheduledTime}
                            onChange={(e) => setPostScheduledTime(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsCreatePostDialogOpen(false)}>
                            キャンセル
                          </Button>
                          <Button onClick={handleCreatePost} disabled={createPostMutation.isPending}>
                            {createPostMutation.isPending ? "作成中..." : "作成"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.posts.map((post) => {
                    const postAccount = project.accounts?.find(pa => pa.accountId === post.accountId);
                    return (
                    <div key={post.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {postAccount && (
                            <p className="text-xs text-muted-foreground mb-1">
                              @{postAccount.account?.xHandle || postAccount.account?.username}
                            </p>
                          )}
                          <p className="font-medium text-slate-900">{post.content.substring(0, 100)}...</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant="outline">{post.status}</Badge>
                          {post.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handlePublishNow(post.id)}
                              disabled={publishNowMutation.isPending}
                            >
                              {publishNowMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3 mr-1" />
                              )}
                              今すぐ投稿
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletePostMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {post.scheduledTime && (
                        <p className="text-sm text-slate-600">
                          予定: {formatDate(post.scheduledTime)}
                        </p>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions">
          <ProjectInteractions projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
