import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Calendar, Target, Users, FileText, Plus, Play, Pause, CheckCircle, Edit, Bot, Sparkles, Loader2, Trash2, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
  const [activeTab, setActiveTab] = useState("accounts");

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
      draft: { label: "下書き", className: "bg-[#F5F5F5] text-[#1A1A1A] border-2 border-[#1A1A1A]", icon: null },
      active: { label: "実行中", className: "bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]", icon: <Play className="h-3 w-3" /> },
      paused: { label: "一時停止", className: "bg-[#FFDAB9] text-[#1A1A1A] border-2 border-[#1A1A1A]", icon: <Pause className="h-3 w-3" /> },
      completed: { label: "完了", className: "bg-[#87CEEB] text-[#1A1A1A] border-2 border-[#1A1A1A]", icon: <CheckCircle className="h-3 w-3" /> },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold gap-1 shadow-[2px_2px_0_#1A1A1A] ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "未設定";
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-[#1A1A1A] font-bold text-lg">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex flex-col items-center justify-center h-64 bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] p-8">
          <h2 className="text-2xl font-black text-[#1A1A1A] mb-2">プロジェクトが見つかりません</h2>
          <p className="text-[#6B6B6B] font-bold mb-6">指定されたプロジェクトは存在しないか、削除されました</p>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
          >
            プロジェクト一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4 font-bold text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-[#FFFDF7]"
          onClick={() => setLocation("/projects")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          プロジェクト一覧に戻る
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-[#1A1A1A]">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-[#6B6B6B] font-bold mt-1">{project.objective}</p>
            {project.description && (
              <p className="text-[#6B6B6B] mt-2 font-bold">{project.description}</p>
            )}
          </div>
          <Button
            className="gap-2 bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
            onClick={() => setLocation(`/projects/${projectId}/edit`)}
          >
            <Edit className="h-4 w-4" />
            編集
          </Button>
        </div>
      </div>

      {/* Execution Mode Card */}
      <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#1A1A1A]" />
            <h3 className="font-black text-sm text-[#1A1A1A]">実行モード</h3>
          </div>
        </div>
        <p className="text-xs text-[#6B6B6B] font-bold mb-3">
          プロジェクトの投稿承認フローを設定します
        </p>
        <ExecutionModeSelector projectId={projectId} currentMode={project.executionMode || 'confirm'} />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFDAB9] rounded-lg border-2 border-[#1A1A1A]">
              <Calendar className="h-5 w-5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B6B] font-bold">期間</p>
              <p className="text-lg font-black text-[#1A1A1A]">
                {formatDate(project.startDate)} 〜 {formatDate(project.endDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4ECDC4] rounded-lg border-2 border-[#1A1A1A]">
              <Users className="h-5 w-5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B6B] font-bold">アカウント数</p>
              <p className="text-lg font-black text-[#1A1A1A]">
                {project.accounts?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#87CEEB] rounded-lg border-2 border-[#1A1A1A]">
              <FileText className="h-5 w-5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B6B] font-bold">投稿数</p>
              <p className="text-lg font-black text-[#1A1A1A]">
                {project.posts?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FFD700] rounded-lg border-2 border-[#1A1A1A]">
              <Target className="h-5 w-5 text-[#1A1A1A]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B6B] font-bold">目標</p>
              <p className="text-lg font-black text-[#1A1A1A]">
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
        </div>
      </div>

      {/* KPI Progress */}
      {project.targets && (
        <div>
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
      <div className="flex gap-1 bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg p-1 w-fit shadow-[4px_4px_0_#1A1A1A]">
        <button onClick={() => setActiveTab("accounts")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === "accounts" ? "bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]" : "text-[#6B6B6B] hover:bg-[#FFF8DC] border-2 border-transparent"}`}>
          アカウント
        </button>
        <button onClick={() => setActiveTab("strategies")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === "strategies" ? "bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]" : "text-[#6B6B6B] hover:bg-[#FFF8DC] border-2 border-transparent"}`}>
          戦略
        </button>
        <button onClick={() => setActiveTab("posts")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === "posts" ? "bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]" : "text-[#6B6B6B] hover:bg-[#FFF8DC] border-2 border-transparent"}`}>
          投稿
        </button>
        <button onClick={() => setActiveTab("interactions")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === "interactions" ? "bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]" : "text-[#6B6B6B] hover:bg-[#FFF8DC] border-2 border-transparent"}`}>
          相互連携
        </button>
      </div>

      {/* Accounts Tab */}
      {activeTab === "accounts" && (
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-black text-sm text-[#1A1A1A]">プロジェクトアカウント</h3>
              <p className="text-xs text-[#6B6B6B] font-bold mb-3">このプロジェクトで使用するSNSアカウント</p>
            </div>
            <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">
                  <Plus className="h-4 w-4" />
                  アカウント追加
                </Button>
              </DialogTrigger>
              <DialogContent className="border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                <DialogHeader>
                  <DialogTitle className="font-black text-[#1A1A1A]">アカウントを追加</DialogTitle>
                  <DialogDescription className="font-bold text-[#6B6B6B]">
                    プロジェクトに追加するアカウントを選択してください
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {availableAccounts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-[#6B6B6B] font-bold mb-4">追加可能なアカウントがありません</p>
                      <Button
                        onClick={() => setLocation("/accounts/new")}
                        className="bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                      >
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
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedAccountId === account.id
                                ? "border-[#1A1A1A] bg-[#FFD700] shadow-[4px_4px_0_#1A1A1A]"
                                : "border-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] shadow-[2px_2px_0_#1A1A1A]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-[#1A1A1A]">{account.username}</p>
                                {account.xHandle && (
                                  <p className="text-sm text-[#6B6B6B] font-bold">@{account.xHandle}</p>
                                )}
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-[#87CEEB] shadow-[2px_2px_0_#1A1A1A]">{account.platform}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setIsAddAccountDialogOpen(false);
                            setSelectedAccountId(null);
                          }}
                          className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={handleAddAccount}
                          disabled={!selectedAccountId || addAccountMutation.isPending}
                          className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold disabled:opacity-50"
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
          <div>
            {!project.accounts || project.accounts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-[#1A1A1A] mx-auto mb-4" />
                <p className="text-[#6B6B6B] font-bold mb-4">まだアカウントが追加されていません</p>
                <Dialog open={isAddAccountDialogOpen} onOpenChange={setIsAddAccountDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">アカウントを追加</Button>
                  </DialogTrigger>
                  <DialogContent className="border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                    <DialogHeader>
                      <DialogTitle className="font-black text-[#1A1A1A]">アカウントを追加</DialogTitle>
                      <DialogDescription className="font-bold text-[#6B6B6B]">
                        プロジェクトに追加するアカウントを選択してください
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {availableAccounts.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-[#6B6B6B] font-bold mb-4">追加可能なアカウントがありません</p>
                          <Button
                            onClick={() => setLocation("/accounts/new")}
                            className="bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                          >
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
                                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                  selectedAccountId === account.id
                                    ? "border-[#1A1A1A] bg-[#FFD700] shadow-[4px_4px_0_#1A1A1A]"
                                    : "border-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] shadow-[2px_2px_0_#1A1A1A]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-bold text-[#1A1A1A]">{account.username}</p>
                                    {account.xHandle && (
                                      <p className="text-sm text-[#6B6B6B] font-bold">@{account.xHandle}</p>
                                    )}
                                  </div>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-[#87CEEB] shadow-[2px_2px_0_#1A1A1A]">{account.platform}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => {
                                setIsAddAccountDialogOpen(false);
                                setSelectedAccountId(null);
                              }}
                              className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                            >
                              キャンセル
                            </Button>
                            <Button
                              onClick={handleAddAccount}
                              disabled={!selectedAccountId || addAccountMutation.isPending}
                              className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold disabled:opacity-50"
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
                  <div key={pa.id} className="flex items-center justify-between p-4 border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] flex items-center justify-center text-[#1A1A1A] font-black shadow-[2px_2px_0_#1A1A1A]">
                        {pa.account?.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1A1A]">{pa.account?.username}</p>
                        <p className="text-sm text-[#6B6B6B] font-bold">
                          Lv.{pa.account?.level || 1} • {pa.account?.experiencePoints || 0} XP
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-[#87CEEB] shadow-[2px_2px_0_#1A1A1A]">{pa.account?.platform}</span>
                      <Link href={`/accounts/${pa.accountId}`}>
                        <Button className="gap-1 bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold text-sm">
                          詳細・設定
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategies Tab */}
      {activeTab === "strategies" && (
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-black text-sm text-[#1A1A1A]">マーケティング戦略</h3>
              <p className="text-xs text-[#6B6B6B] font-bold mb-3">このプロジェクトに紐づく戦略</p>
            </div>
            <div className="flex gap-2">
              <Button
                className="gap-2 bg-[#DDA0DD] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
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
                <Button className="gap-2 bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">
                  <Plus className="h-4 w-4" />
                  基本戦略を生成
                </Button>
              </Link>
            </div>
          </div>
          <div>
            {!project.strategies || project.strategies.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-[#1A1A1A] mx-auto mb-4" />
                <p className="text-[#6B6B6B] font-bold mb-4">まだ戦略が生成されていません</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleGenerateStrategy}
                    disabled={isGeneratingStrategy}
                    className="bg-[#DDA0DD] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                  >
                    {isGeneratingStrategy ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isGeneratingStrategy ? "生成中..." : "データ統合戦略を生成"}
                  </Button>
                  <Link href="/strategies/new">
                    <Button className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">基本戦略を生成</Button>
                  </Link>
                </div>
                <p className="text-xs text-[#6B6B6B] font-bold mt-4">
                  ※データ統合戦略：バズ分析データとモデルアカウントの学習を活用して戦略を生成します
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {project.strategies.map((strategy: any) => (
                  <div key={strategy.id} className="p-4 border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-[#1A1A1A] mb-1">{strategy.objective}</p>
                        <p className="text-sm text-[#6B6B6B] font-bold">{strategy.contentType}</p>
                      </div>
                      {(strategy.incorporatedBuzzLearnings || strategy.incorporatedModelPatterns) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#DDA0DD] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] gap-1">
                          <Sparkles className="h-3 w-3" />
                          データ統合
                        </span>
                      )}
                    </div>
                    {strategy.timingGuidelines && (
                      <div className="mt-2 text-xs text-[#6B6B6B] font-bold">
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
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === "posts" && (
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-black text-sm text-[#1A1A1A]">投稿スケジュール</h3>
              <p className="text-xs text-[#6B6B6B] font-bold mb-3">予定されている投稿と実績</p>
            </div>
            <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">
                  <Plus className="h-4 w-4" />
                  投稿を作成
                </Button>
              </DialogTrigger>
              <DialogContent className="border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                <DialogHeader>
                  <DialogTitle className="font-black text-[#1A1A1A]">投稿を作成</DialogTitle>
                  <DialogDescription className="font-bold text-[#6B6B6B]">
                    新しい投稿をスケジュールします
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A]">投稿するアカウント</label>
                    <Select
                      value={selectedPostAccountId?.toString() || ""}
                      onValueChange={(value) => setSelectedPostAccountId(value ? parseInt(value) : null)}
                    >
                      <SelectTrigger className="border-2 border-[#1A1A1A] rounded-lg font-bold bg-[#FFFDF7]">
                        <SelectValue placeholder="アカウントを選択" />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7]">
                        {project?.accounts?.map((pa) => (
                          <SelectItem key={pa.accountId} value={pa.accountId.toString()}>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{pa.account?.username}</span>
                              {pa.account?.xHandle && (
                                <span className="text-[#6B6B6B] text-xs font-bold">@{pa.account.xHandle}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A]">エージェント（AI自動生成）</label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedAgent?.toString()}
                        onValueChange={(value) => setSelectedAgent(value ? parseInt(value) : undefined)}
                      >
                        <SelectTrigger className="flex-1 min-w-0 border-2 border-[#1A1A1A] rounded-lg font-bold bg-[#FFFDF7]">
                          <SelectValue placeholder="エージェントを選択（任意）" />
                        </SelectTrigger>
                        <SelectContent className="max-w-[calc(100vw-4rem)] border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7]">
                          {agents?.map((agent: any) => (
                            <SelectItem key={agent.id} value={agent.id.toString()}>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-[#DDA0DD]" />
                                <span className="font-bold">{agent.name}</span>
                                <span className="text-[#6B6B6B] text-xs font-bold">- {agent.theme}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={handleGenerateContent}
                        disabled={!selectedAgent || isGenerating}
                        className="flex-shrink-0 bg-[#DDA0DD] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold disabled:opacity-50"
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
                      <p className="text-xs text-[#6B6B6B] font-bold">
                        選択したエージェントのスタイルで投稿内容を自動生成します
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A]">投稿内容</label>
                    <textarea
                      className="w-full min-h-[120px] p-3 border-2 border-[#1A1A1A] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD700] bg-[#FFFDF7] font-bold text-[#1A1A1A]"
                      placeholder="投稿内容を入力、またはエージェントでAI生成..."
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A]">投稿予定日時</label>
                    <input
                      type="datetime-local"
                      className="w-full p-3 border-2 border-[#1A1A1A] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] bg-[#FFFDF7] font-bold text-[#1A1A1A]"
                      value={postScheduledTime}
                      onChange={(e) => setPostScheduledTime(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setIsCreatePostDialogOpen(false)}
                      className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                    >
                      キャンセル
                    </Button>
                    <Button
                      onClick={handleCreatePost}
                      disabled={createPostMutation.isPending}
                      className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold disabled:opacity-50"
                    >
                      {createPostMutation.isPending ? "作成中..." : "作成"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            {!project.posts || project.posts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-[#1A1A1A] mx-auto mb-4" />
                <p className="text-[#6B6B6B] font-bold mb-4">まだ投稿が作成されていません</p>
                <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#4ECDC4] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold">投稿を作成</Button>
                  </DialogTrigger>
                  <DialogContent className="border-2 border-[#1A1A1A] shadow-[8px_8px_0_#1A1A1A] rounded-lg bg-[#FFFDF7]">
                    <DialogHeader>
                      <DialogTitle className="font-black text-[#1A1A1A]">投稿を作成</DialogTitle>
                      <DialogDescription className="font-bold text-[#6B6B6B]">
                        新しい投稿をスケジュールします
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#1A1A1A]">投稿するアカウント</label>
                        <Select
                          value={selectedPostAccountId?.toString() || ""}
                          onValueChange={(value) => setSelectedPostAccountId(value ? parseInt(value) : null)}
                        >
                          <SelectTrigger className="border-2 border-[#1A1A1A] rounded-lg font-bold bg-[#FFFDF7]">
                            <SelectValue placeholder="アカウントを選択" />
                          </SelectTrigger>
                          <SelectContent className="border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7]">
                            {project?.accounts?.map((pa) => (
                              <SelectItem key={pa.accountId} value={pa.accountId.toString()}>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{pa.account?.username}</span>
                                  {pa.account?.xHandle && (
                                    <span className="text-[#6B6B6B] text-xs font-bold">@{pa.account.xHandle}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#1A1A1A]">エージェント（AI自動生成）</label>
                        <div className="flex gap-2">
                          <Select
                            value={selectedAgent?.toString()}
                            onValueChange={(value) => setSelectedAgent(value ? parseInt(value) : undefined)}
                          >
                            <SelectTrigger className="flex-1 min-w-0 max-w-full border-2 border-[#1A1A1A] rounded-lg font-bold bg-[#FFFDF7]">
                              <SelectValue placeholder="エージェントを選択（任意）" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[calc(100vw-4rem)] border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7]">
                              {agents?.map((agent: any) => (
                                <SelectItem key={agent.id} value={agent.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-[#DDA0DD]" />
                                    <span className="font-bold">{agent.name}</span>
                                    <span className="text-[#6B6B6B] text-xs font-bold">- {agent.theme}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            onClick={handleGenerateContent}
                            disabled={!selectedAgent || isGenerating}
                            className="flex-shrink-0 bg-[#DDA0DD] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold disabled:opacity-50"
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
                          <p className="text-xs text-[#6B6B6B] font-bold">
                            選択したエージェントのスタイルで投稿内容を自動生成します
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#1A1A1A]">投稿内容</label>
                        <textarea
                          className="w-full min-h-[120px] p-3 border-2 border-[#1A1A1A] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD700] bg-[#FFFDF7] font-bold text-[#1A1A1A]"
                          placeholder="投稿内容を入力、またはエージェントでAI生成..."
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-[#1A1A1A]">投稿予定日時</label>
                        <input
                          type="datetime-local"
                          className="w-full p-3 border-2 border-[#1A1A1A] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] bg-[#FFFDF7] font-bold text-[#1A1A1A]"
                          value={postScheduledTime}
                          onChange={(e) => setPostScheduledTime(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => setIsCreatePostDialogOpen(false)}
                          className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={handleCreatePost}
                          disabled={createPostMutation.isPending}
                          className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold disabled:opacity-50"
                        >
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
                  <div key={post.id} className="p-4 border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        {postAccount && (
                          <p className="text-xs text-[#6B6B6B] font-bold mb-1">
                            @{postAccount.account?.xHandle || postAccount.account?.username}
                          </p>
                        )}
                        <p className="font-bold text-[#1A1A1A]">{post.content.substring(0, 100)}...</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-[#87CEEB] shadow-[2px_2px_0_#1A1A1A]">{post.status}</span>
                        {post.status === "pending" && (
                          <Button
                            className="h-8 text-xs bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
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
                          className="h-8 w-8 p-0 bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletePostMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {post.scheduledTime && (
                      <p className="text-sm text-[#6B6B6B] font-bold">
                        予定: {formatDate(post.scheduledTime)}
                      </p>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactions Tab */}
      {activeTab === "interactions" && (
        <ProjectInteractions projectId={projectId} />
      )}
    </div>
  );
}
