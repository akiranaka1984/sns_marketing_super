import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Calendar, Plus, Play, X, Clock, CheckCircle2, XCircle, Bot, Sparkles, Loader2, RefreshCw, ImagePlus, Trash, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { calculateCharCount, getCharCountDisplay, isCharCountExceeded } from "@/lib/charCounter";

export default function ScheduledPosts() {

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<number | undefined>();
  const [selectedAccount, setSelectedAccount] = useState<number | undefined>();
  const [selectedAgent, setSelectedAgent] = useState<number | undefined>();
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [repeatInterval, setRepeatInterval] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [isGenerating, setIsGenerating] = useState(false);

  // Queries
  const postsQuery = trpc.scheduledPosts.getAll.useQuery({ limit: 100 });
  const projectsQuery = trpc.projects.list.useQuery();
  const accountsQuery = trpc.accounts.list.useQuery();

  // Selected account data
  const selectedAccountData = accountsQuery.data?.find(a => a.id === selectedAccount);
  const agentsQuery = trpc.agents.list.useQuery();

  // Generate content mutation
  const generateMutation = trpc.scheduledPosts.generateWithAgent.useMutation({
    onSuccess: (data) => {
      const hashtagsText = data.hashtags?.length > 0 ? '\n\n' + data.hashtags.map((h: string) => `#${h}`).join(' ') : '';
      setContent(data.content + hashtagsText);
      toast.success(`「${data.agentName}」が投稿内容を生成しました`);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(`生成エラー: ${error.message}`);
      setIsGenerating(false);
    },
  });

  // Mutations
  const createMutation = trpc.scheduledPosts.create.useMutation({
    onSuccess: () => {
      toast.success("スケジュール投稿を作成しました");
      postsQuery.refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = trpc.scheduledPosts.cancel.useMutation({
    onSuccess: () => {
      toast.success("スケジュール投稿をキャンセルしました");
      postsQuery.refetch();
    },
  });

  const publishNowMutation = trpc.scheduledPosts.publishNow.useMutation({
    onSuccess: () => {
      toast.success("投稿を実行しました");
      postsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const retryMutation = trpc.scheduledPosts.retryFailed.useMutation({
    onSuccess: () => {
      toast.success("投稿を再試行しました");
      postsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`再試行エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.scheduledPosts.delete.useMutation({
    onSuccess: () => {
      toast.success("スケジュール投稿を削除しました");
      postsQuery.refetch();
    },
  });

  const resetForm = () => {
    setSelectedProject(undefined);
    setSelectedAccount(undefined);
    setSelectedAgent(undefined);
    setContent("");
    setMediaFiles([]);
    setMediaUrls([]);
    setScheduledTime("");
    setRepeatInterval("none");
  };

  const handleGenerateContent = () => {
    if (!selectedAgent) {
      toast.error("エージェントを選択してください");
      return;
    }
    setIsGenerating(true);
    generateMutation.mutate({ agentId: selectedAgent, accountId: selectedAccount });
  };

  const handleCreate = async () => {
    if (!selectedProject || !selectedAccount || !content || !scheduledTime) {
      toast.error("すべての項目を入力してください");
      return;
    }

    // Instagramの場合、画像が必須
    if (selectedAccountData?.platform === 'instagram' && mediaFiles.length === 0 && mediaUrls.length === 0) {
      toast.error("Instagram投稿には画像または動画が必須です");
      return;
    }

    // 画像をアップロード
    let uploadedUrls: string[] = [...mediaUrls];
    if (mediaFiles.length > 0) {
      setIsUploadingMedia(true);
      try {
        for (const file of mediaFiles) {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('画像アップロード失敗');
          }

          const data = await response.json();
          uploadedUrls.push(data.url);
        }
      } catch (error) {
        toast.error(`画像アップロードエラー: ${error}`);
        setIsUploadingMedia(false);
        return;
      } finally {
        setIsUploadingMedia(false);
      }
    }

    createMutation.mutate({
      projectId: selectedProject,
      accountId: selectedAccount,
      content,
      mediaUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      scheduledTime: new Date(scheduledTime),
      repeatInterval,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-bold text-yellow-700">
            <Clock className="h-3 w-3" />
            待機中
          </span>
        );
      case "posted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            投稿済み
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
            <XCircle className="h-3 w-3" />
            失敗
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-[#F5F5F5] px-2 py-0.5 text-xs font-bold text-[#737373]">
            <X className="h-3 w-3" />
            キャンセル
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-[#E5E5E5] px-2 py-0.5 text-xs font-bold text-[#737373]">
            {status}
          </span>
        );
    }
  };

  const getRepeatBadge = (interval: string) => {
    switch (interval) {
      case "daily":
        return <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-2 py-0.5 text-xs font-bold text-[#525252]">毎日</span>;
      case "weekly":
        return <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-2 py-0.5 text-xs font-bold text-[#525252]">毎週</span>;
      case "monthly":
        return <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-2 py-0.5 text-xs font-bold text-[#525252]">毎月</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">スケジュール投稿</h1>
            <p className="page-subtitle">
              指定した日時に自動的に投稿を実行
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-lg bg-[#D4380D] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#B8300B]">
                <Plus className="h-4 w-4" />
                新規作成
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-[#1A1A1A] font-bold">スケジュール投稿を作成</DialogTitle>
                <DialogDescription className="text-[#737373] text-sm">
                  投稿内容と実行日時を設定してください
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="project" className="text-xs font-bold text-[#525252]">プロジェクト</Label>
                  <Select
                    value={selectedProject?.toString()}
                    onValueChange={(value) => setSelectedProject(parseInt(value))}
                  >
                    <SelectTrigger className="border-[#E5E5E5]">
                      <SelectValue placeholder="プロジェクトを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectsQuery.data?.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account" className="text-xs font-bold text-[#525252]">アカウント（投稿に使用するデバイス）</Label>
                  <Select
                    value={selectedAccount?.toString()}
                    onValueChange={(value) => setSelectedAccount(parseInt(value))}
                  >
                    <SelectTrigger className="border-[#E5E5E5]">
                      <SelectValue placeholder="アカウントを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsQuery.data?.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1A1A1A]">{account.platform}</span>
                            <span className="text-sm text-[#525252]">@{account.username}</span>
                            {account.deviceId ? (
                              <span className="ml-2 inline-flex items-center rounded-full border border-[#E5E5E5] px-2 py-0.5 text-xs text-[#737373]">
                                デバイス: {account.deviceId.slice(0, 8)}...
                              </span>
                            ) : (
                              <span className="ml-2 inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-600">
                                デバイス未設定
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent" className="text-xs font-bold text-[#525252]">エージェント（AI自動生成）</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedAgent?.toString()}
                      onValueChange={(value) => setSelectedAgent(parseInt(value))}
                    >
                      <SelectTrigger className="flex-1 border-[#E5E5E5]">
                        <SelectValue placeholder="エージェントを選択（任意）" />
                      </SelectTrigger>
                      <SelectContent>
                        {agentsQuery.data?.map((agent: any) => (
                          <SelectItem key={agent.id} value={agent.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-[#D4380D]" />
                              <span className="font-bold text-sm">{agent.name}</span>
                              <span className="text-[#A3A3A3] text-xs">- {agent.theme}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] px-3 py-2 text-sm font-bold text-[#525252] transition-colors hover:bg-[#E5E5E5] disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleGenerateContent}
                      disabled={!selectedAgent || isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isGenerating ? "生成中..." : "AI生成"}
                    </button>
                  </div>
                  {selectedAgent && agentsQuery.data && (
                    <p className="text-xs text-[#A3A3A3]">
                      選択したエージェントのスタイルで投稿内容を自動生成します
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content" className="text-xs font-bold text-[#525252]">投稿内容</Label>
                    <span className={`text-sm ${
                      isCharCountExceeded(content)
                        ? 'text-red-600 font-bold'
                        : calculateCharCount(content) > 240
                          ? 'text-orange-600 font-bold'
                          : 'text-[#A3A3A3]'
                    }`}>
                      {getCharCountDisplay(content)}
                    </span>
                  </div>
                  <Textarea
                    id="content"
                    placeholder="投稿内容を入力、またはエージェントでAI生成..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className={`border-[#E5E5E5] text-sm ${isCharCountExceeded(content) ? 'border-red-500' : ''}`}
                  />
                  {isCharCountExceeded(content) && (
                    <p className="text-xs text-red-600">
                      文字数が上限を超えています（全角文字は2文字としてカウント）
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media" className="text-xs font-bold text-[#525252]">画像・動画</Label>
                  {selectedAccountData?.platform === 'instagram' && (
                    <p className="text-xs text-[#A3A3A3] mb-2">
                      ※ Instagram投稿には画像または動画が必須です
                    </p>
                  )}
                  <div className="space-y-2">
                    <Input
                      id="media"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="border-[#E5E5E5] text-sm"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setMediaFiles(files);
                      }}
                    />
                    {mediaFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {mediaFiles.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="w-20 h-20 border border-[#E5E5E5] rounded-lg overflow-hidden">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`プレビュー ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                              onClick={() => {
                                setMediaFiles(mediaFiles.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledTime" className="text-xs font-bold text-[#525252]">実行日時</Label>
                  <Input
                    id="scheduledTime"
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="border-[#E5E5E5] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeatInterval" className="text-xs font-bold text-[#525252]">繰り返し</Label>
                  <Select
                    value={repeatInterval}
                    onValueChange={(value: any) => setRepeatInterval(value)}
                  >
                    <SelectTrigger className="border-[#E5E5E5]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">なし</SelectItem>
                      <SelectItem value="daily">毎日</SelectItem>
                      <SelectItem value="weekly">毎週</SelectItem>
                      <SelectItem value="monthly">毎月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <button
                  className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-sm font-bold text-[#525252] transition-colors hover:bg-[#F5F5F5]"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  キャンセル
                </button>
                <button
                  className="rounded-lg bg-[#D4380D] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#B8300B] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  作成
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Posts Table Card */}
        <div className="bg-white rounded-lg border border-[#E5E5E5]">
          <div className="px-5 py-4 border-b border-[#F0F0F0]">
            <h2 className="text-sm font-bold text-[#1A1A1A]">スケジュール投稿一覧</h2>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              {postsQuery.data?.length || 0}件の投稿が登録されています
            </p>
          </div>
          <div className="p-0">
            {postsQuery.isLoading ? (
              <p className="text-center text-sm text-[#A3A3A3] py-12">読み込み中...</p>
            ) : postsQuery.data && postsQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-[60px_1fr_160px_80px_100px_50px_200px] gap-3 px-5 py-3 border-b border-[#F0F0F0] bg-[#FAFAFA] text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">
                  <div>ID</div>
                  <div>内容</div>
                  <div>実行日時</div>
                  <div>繰り返し</div>
                  <div>ステータス</div>
                  <div>検証</div>
                  <div>アクション</div>
                </div>
                {/* Table Rows */}
                {postsQuery.data.map((post) => (
                  <div
                    key={post.id}
                    className="grid grid-cols-[60px_1fr_160px_80px_100px_50px_200px] gap-3 px-5 py-3 border-b border-[#F0F0F0] last:border-b-0 items-center hover:bg-[#FAFAFA] transition-colors"
                  >
                    <div className="font-mono text-xs text-[#737373]">{post.id}</div>
                    <div className="text-sm text-[#1A1A1A] truncate">{post.content}</div>
                    <div className="text-xs text-[#525252]">
                      {new Date(post.scheduledTime).toLocaleString("ja-JP")}
                    </div>
                    <div>{getRepeatBadge(post.repeatInterval)}</div>
                    <div>{getStatusBadge(post.status)}</div>
                    <div>
                      {post.screenshotUrl && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="flex items-center justify-center h-8 w-8 rounded-lg text-[#737373] transition-colors hover:bg-[#F5F5F5] hover:text-[#1A1A1A]">
                              <ImageIcon className="h-4 w-4" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle className="text-[#1A1A1A] font-bold">投稿検証スクリーンショット</DialogTitle>
                              <DialogDescription className="text-[#737373] text-sm">
                                投稿ID: {post.id} - {new Date(post.scheduledTime).toLocaleString("ja-JP")}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4">
                              <img
                                src={post.screenshotUrl}
                                alt="投稿検証スクリーンショット"
                                className="w-full h-auto rounded-lg border border-[#E5E5E5]"
                              />
                            </div>
                            {post.postUrl && (
                              <div className="mt-4">
                                <Label className="text-xs font-bold text-[#525252]">投稿URL</Label>
                                <a
                                  href={post.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#D4380D] hover:underline text-sm"
                                >
                                  {post.postUrl}
                                </a>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {post.status === "pending" && (
                        <>
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs font-bold text-[#525252] transition-colors hover:bg-[#F5F5F5]"
                            onClick={() => publishNowMutation.mutate({ id: post.id })}
                          >
                            <Play className="h-3 w-3" />
                            今すぐ実行
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white px-2.5 py-1.5 text-xs font-bold text-[#525252] transition-colors hover:bg-[#F5F5F5]"
                            onClick={() => cancelMutation.mutate({ id: post.id })}
                          >
                            <X className="h-3 w-3" />
                            キャンセル
                          </button>
                        </>
                      )}
                      {post.status === "failed" && (
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-50"
                          onClick={() => retryMutation.mutate({ id: post.id })}
                        >
                          <RefreshCw className="h-3 w-3" />
                          再試行
                        </button>
                      )}
                      <button
                        className="inline-flex items-center rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700"
                        onClick={() => deleteMutation.mutate({ id: post.id })}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-[#A3A3A3] py-12">
                スケジュール投稿がありません
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
