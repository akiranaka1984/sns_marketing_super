import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        return <Badge variant="outline" className="text-yellow-600"><Clock className="h-3 w-3 mr-1" />待機中</Badge>;
      case "posted":
        return <Badge variant="outline" className="text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />投稿済み</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-red-600"><XCircle className="h-3 w-3 mr-1" />失敗</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-gray-600"><X className="h-3 w-3 mr-1" />キャンセル</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRepeatBadge = (interval: string) => {
    switch (interval) {
      case "daily":
        return <Badge variant="secondary">毎日</Badge>;
      case "weekly":
        return <Badge variant="secondary">毎週</Badge>;
      case "monthly":
        return <Badge variant="secondary">毎月</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">スケジュール投稿</h1>
          <p className="text-muted-foreground">
            指定した日時に自動的に投稿を実行
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>スケジュール投稿を作成</DialogTitle>
              <DialogDescription>
                投稿内容と実行日時を設定してください
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project">プロジェクト</Label>
                <Select
                  value={selectedProject?.toString()}
                  onValueChange={(value) => setSelectedProject(parseInt(value))}
                >
                  <SelectTrigger>
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
                <Label htmlFor="account">アカウント（投稿に使用するデバイス）</Label>
                <Select
                  value={selectedAccount?.toString()}
                  onValueChange={(value) => setSelectedAccount(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="アカウントを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data?.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.platform}</span>
                          <span>@{account.username}</span>
                          {account.deviceId ? (
                            <Badge variant="outline" className="ml-2 text-xs">
                              デバイス: {account.deviceId.slice(0, 8)}...
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              デバイス未設定
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccount && accountsQuery.data && !accountsQuery.data.find(a => a.id === selectedAccount)?.deviceId && (
                  <p className="text-sm text-destructive">
                    ※ このアカウントはDuoPlusデバイスに紐付けられていません。「デバイス管理」ページで紐付けを行ってください。
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent">エージェント（AI自動生成）</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedAgent?.toString()}
                    onValueChange={(value) => setSelectedAgent(parseInt(value))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="エージェントを選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentsQuery.data?.map((agent: any) => (
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
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isGenerating ? "生成中..." : "AI生成"}
                  </Button>
                </div>
                {selectedAgent && agentsQuery.data && (
                  <p className="text-xs text-muted-foreground">
                    選択したエージェントのスタイルで投稿内容を自動生成します
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">投稿内容</Label>
                  <span className={`text-sm ${
                    isCharCountExceeded(content) 
                      ? 'text-destructive font-semibold' 
                      : calculateCharCount(content) > 240 
                        ? 'text-orange-600 font-medium' 
                        : 'text-muted-foreground'
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
                  className={isCharCountExceeded(content) ? 'border-destructive' : ''}
                />
                {isCharCountExceeded(content) && (
                  <p className="text-xs text-destructive">
                    文字数が上限を超えています（全角文字は2文字としてカウント）
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="media">画像・動画</Label>
                {selectedAccountData?.platform === 'instagram' && (
                  <p className="text-xs text-muted-foreground mb-2">
                    ※ Instagram投稿には画像または動画が必須です
                  </p>
                )}
                <div className="space-y-2">
                  <Input
                    id="media"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setMediaFiles(files);
                    }}
                  />
                  {mediaFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {mediaFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          <div className="w-20 h-20 border rounded overflow-hidden">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`プレビュー ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setMediaFiles(mediaFiles.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledTime">実行日時</Label>
                <Input
                  id="scheduledTime"
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repeatInterval">繰り返し</Label>
                <Select
                  value={repeatInterval}
                  onValueChange={(value: any) => setRepeatInterval(value)}
                >
                  <SelectTrigger>
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
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>スケジュール投稿一覧</CardTitle>
          <CardDescription>
            {postsQuery.data?.length || 0}件の投稿が登録されています
          </CardDescription>
        </CardHeader>
        <CardContent>
          {postsQuery.isLoading ? (
            <p className="text-center text-muted-foreground py-8">読み込み中...</p>
          ) : postsQuery.data && postsQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>実行日時</TableHead>
                  <TableHead>繰り返し</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>検証</TableHead>
                  <TableHead>アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postsQuery.data.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-mono text-sm">{post.id}</TableCell>
                    <TableCell className="max-w-xs truncate">{post.content}</TableCell>
                    <TableCell>
                      {new Date(post.scheduledTime).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>{getRepeatBadge(post.repeatInterval)}</TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>
                      {post.screenshotUrl && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>投稿検証スクリーンショット</DialogTitle>
                              <DialogDescription>
                                投稿ID: {post.id} - {new Date(post.scheduledTime).toLocaleString("ja-JP")}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4">
                              <img
                                src={post.screenshotUrl}
                                alt="投稿検証スクリーンショット"
                                className="w-full h-auto rounded-lg border"
                              />
                            </div>
                            {post.postUrl && (
                              <div className="mt-4">
                                <Label>投稿URL</Label>
                                <a
                                  href={post.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  {post.postUrl}
                                </a>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {post.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => publishNowMutation.mutate({ id: post.id })}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              今すぐ実行
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelMutation.mutate({ id: post.id })}
                            >
                              <X className="h-3 w-3 mr-1" />
                              キャンセル
                            </Button>
                          </>
                        )}
                        {post.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-600 hover:text-orange-700"
                            onClick={() => retryMutation.mutate({ id: post.id })}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            再試行
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate({ id: post.id })}
                        >
                          削除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              スケジュール投稿がありません
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
