import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { Bot, Plus, Edit, Trash2, User, Sparkles, Clock, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type AgentFormData = {
  name: string;
  theme: string;
  tone: "formal" | "casual" | "friendly" | "professional" | "humorous";
  style: "ranking" | "trivia" | "story" | "tutorial" | "news" | "review";
  targetAudience: string;
  description: string;
  postingFrequency?: "daily" | "twice_daily" | "three_times_daily" | "weekly" | "custom";
  postingTimeSlots?: string[];
  skipReview?: boolean;
};

const initialFormData: AgentFormData = {
  name: "",
  theme: "",
  tone: "casual",
  style: "story",
  targetAudience: "",
  description: "",
  postingFrequency: "daily",
  postingTimeSlots: ["09:00"],
  skipReview: false,
};

export default function Agents() {
  const { t } = useI18n();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAIGenerateDialogOpen, setIsAIGenerateDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  
  // AI generation form
  const [aiGenCount, setAiGenCount] = useState(5);
  const [aiGenIndustry, setAiGenIndustry] = useState("");
  const [aiGenPlatforms, setAiGenPlatforms] = useState<string[]>([]);

  // Schedule editing
  const [scheduleTimeSlot, setScheduleTimeSlot] = useState("");

  const utils = trpc.useUtils();
  const { data: agents = [], isLoading } = trpc.agents.list.useQuery();
  
  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      toast.success("新しいSNSエージェントが作成されました。");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateMutation = trpc.agents.update.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      setIsEditDialogOpen(false);
      setEditingAgent(null);
      setFormData(initialFormData);
      toast.success("SNSエージェントが更新されました。");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.agents.delete.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      toast.success("SNSエージェントが削除されました。");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const generateAgentsMutation = trpc.agents.generateAgents.useMutation({
    onSuccess: (data) => {
      utils.agents.list.invalidate();
      setIsAIGenerateDialogOpen(false);
      setAiGenCount(5);
      setAiGenIndustry("");
      setAiGenPlatforms([]);
      toast.success(`${data.count}個のSNSエージェントが自動生成されました。`);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateScheduleMutation = trpc.agents.updateSchedule.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      toast.success("スケジュールが更新されました。");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      ...formData,
      postingTimeSlots: formData.postingTimeSlots || ["09:00"],
    });
  };

  const handleEdit = (agent: any) => {
    setEditingAgent(agent);
    const timeSlots = agent.postingTimeSlots 
      ? (typeof agent.postingTimeSlots === "string" 
          ? JSON.parse(agent.postingTimeSlots) 
          : agent.postingTimeSlots)
      : ["09:00"];
    
    setFormData({
      name: agent.name,
      theme: agent.theme,
      tone: agent.tone,
      style: agent.style,
      targetAudience: agent.targetAudience || "",
      description: agent.description || "",
      postingFrequency: agent.postingFrequency || "daily",
      postingTimeSlots: timeSlots,
      skipReview: agent.skipReview || false,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingAgent) return;
    updateMutation.mutate({
      id: editingAgent.id,
      ...formData,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("本当にこのSNSエージェントを削除しますか?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAIGenerate = () => {
    // Ensure count is a valid number between 1 and 20
    const validCount = Math.max(1, Math.min(20, Number(aiGenCount) || 5));
    generateAgentsMutation.mutate({
      count: validCount,
      industry: aiGenIndustry || undefined,
      targetPlatforms: aiGenPlatforms.length > 0
        ? aiGenPlatforms as ("twitter" | "instagram" | "facebook" | "tiktok")[]
        : undefined,
    });
  };

  const handleToggleActive = (agentId: number, currentStatus: boolean) => {
    updateScheduleMutation.mutate({
      id: agentId,
      isActive: !currentStatus,
    });
  };

  const handleAddTimeSlot = () => {
    if (!scheduleTimeSlot) return;
    const currentSlots = formData.postingTimeSlots || [];
    if (!currentSlots.includes(scheduleTimeSlot)) {
      setFormData({
        ...formData,
        postingTimeSlots: [...currentSlots, scheduleTimeSlot],
      });
      setScheduleTimeSlot("");
    }
  };

  const handleRemoveTimeSlot = (slot: string) => {
    setFormData({
      ...formData,
      postingTimeSlots: (formData.postingTimeSlots || []).filter(s => s !== slot),
    });
  };

  const getToneLabel = (tone: string) => {
    const labels: Record<string, string> = {
      formal: "フォーマル",
      casual: "カジュアル",
      friendly: "フレンドリー",
      professional: "プロフェッショナル",
      humorous: "ユーモラス",
    };
    return labels[tone] || tone;
  };

  const getStyleLabel = (style: string) => {
    const labels: Record<string, string> = {
      ranking: "ランキング",
      trivia: "トリビア",
      story: "ストーリー",
      tutorial: "チュートリアル",
      news: "ニュース",
      review: "レビュー",
    };
    return labels[style] || style;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: "1日1回",
      twice_daily: "1日2回",
      three_times_daily: "1日3回",
      weekly: "週1回",
      custom: "カスタム",
    };
    return labels[freq] || freq;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('agents.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('agents.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsAIGenerateDialogOpen(true)} variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            AI自動生成
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {agents.map((agent: any) => {
          const timeSlots = agent.postingTimeSlots 
            ? (typeof agent.postingTimeSlots === "string" 
                ? JSON.parse(agent.postingTimeSlots) 
                : agent.postingTimeSlots)
            : [];
          
          return (
            <Card key={agent.id} className={`transition-all hover:shadow-md ${!agent.isActive ? "opacity-60 bg-muted/30" : ""}`}>
              <div className="flex items-stretch">
                {/* Left: Status indicator */}
                <div className={`w-1.5 rounded-l-lg ${agent.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                
                {/* Main content */}
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side: Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-lg truncate">{agent.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{agent.theme}</p>
                        </div>
                      </div>
                      
                      {/* Tags row */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge variant="secondary" className="font-normal">
                          {getToneLabel(agent.tone)}
                        </Badge>
                        <Badge variant="outline" className="font-normal">
                          {getStyleLabel(agent.style)}
                        </Badge>
                        {agent.targetAudience && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{agent.targetAudience}</span>
                          </span>
                        )}
                      </div>
                      
                      {/* Description */}
                      {agent.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {agent.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Right side: Schedule & Actions */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(agent.id, agent.isActive)}
                          title={agent.isActive ? "無効化" : "有効化"}
                        >
                          {agent.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(agent)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(agent.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Schedule info */}
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{getFrequencyLabel(agent.postingFrequency || "daily")}</span>
                        </div>
                        {timeSlots.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1">
                            {timeSlots.slice(0, 4).map((slot: string) => (
                              <Badge key={slot} variant="outline" className="text-xs px-1.5 py-0">
                                {slot}
                              </Badge>
                            ))}
                            {timeSlots.length > 4 && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                +{timeSlots.length - 4}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Detail button */}
                      <Link href={`/agents/${agent.id}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          詳細を見る
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新しいSNSエージェントを作成</DialogTitle>
            <DialogDescription>
              エージェントの詳細情報と投稿スケジュールを入力してください
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">エージェント名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: テクノロジーレビュアー"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="theme">テーマ *</Label>
              <Input
                id="theme"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                placeholder="例: 最新のスマートフォンとガジェットの詳細レビュー"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tone">トーン</Label>
                <Select
                  value={formData.tone}
                  onValueChange={(value: any) => setFormData({ ...formData, tone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">フォーマル</SelectItem>
                    <SelectItem value="casual">カジュアル</SelectItem>
                    <SelectItem value="friendly">フレンドリー</SelectItem>
                    <SelectItem value="professional">プロフェッショナル</SelectItem>
                    <SelectItem value="humorous">ユーモラス</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="style">スタイル</Label>
                <Select
                  value={formData.style}
                  onValueChange={(value: any) => setFormData({ ...formData, style: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ranking">ランキング</SelectItem>
                    <SelectItem value="trivia">トリビア</SelectItem>
                    <SelectItem value="story">ストーリー</SelectItem>
                    <SelectItem value="tutorial">チュートリアル</SelectItem>
                    <SelectItem value="news">ニュース</SelectItem>
                    <SelectItem value="review">レビュー</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetAudience">ターゲットオーディエンス</Label>
              <Input
                id="targetAudience"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                placeholder="例: 20-40歳のテクノロジー愛好家"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="エージェントの特徴や目的を入力"
                rows={3}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <h3 className="font-semibold mb-4">投稿設定</h3>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="skipReview">審査をスキップ</Label>
                    <p className="text-sm text-muted-foreground">
                      AI生成後、審査なしで自動投稿キューに追加
                    </p>
                  </div>
                  <Switch
                    id="skipReview"
                    checked={formData.skipReview || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, skipReview: checked })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postingFrequency">投稿頻度</Label>
                  <Select
                    value={formData.postingFrequency}
                    onValueChange={(value: any) => setFormData({ ...formData, postingFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">1日1回</SelectItem>
                      <SelectItem value="twice_daily">1日2回</SelectItem>
                      <SelectItem value="three_times_daily">1日3回</SelectItem>
                      <SelectItem value="weekly">週1回</SelectItem>
                      <SelectItem value="custom">カスタム</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>投稿時間帯</Label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={scheduleTimeSlot}
                      onChange={(e) => setScheduleTimeSlot(e.target.value)}
                      placeholder="09:00"
                    />
                    <Button type="button" onClick={handleAddTimeSlot} variant="outline">
                      追加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.postingTimeSlots || []).map((slot) => (
                      <Badge key={slot} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTimeSlot(slot)}>
                        {slot} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SNSエージェントを編集</DialogTitle>
            <DialogDescription>
              エージェントの詳細情報と投稿スケジュールを更新してください
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">エージェント名 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-theme">テーマ *</Label>
              <Input
                id="edit-theme"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-tone">トーン</Label>
                <Select
                  value={formData.tone}
                  onValueChange={(value: any) => setFormData({ ...formData, tone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">フォーマル</SelectItem>
                    <SelectItem value="casual">カジュアル</SelectItem>
                    <SelectItem value="friendly">フレンドリー</SelectItem>
                    <SelectItem value="professional">プロフェッショナル</SelectItem>
                    <SelectItem value="humorous">ユーモラス</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-style">スタイル</Label>
                <Select
                  value={formData.style}
                  onValueChange={(value: any) => setFormData({ ...formData, style: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ranking">ランキング</SelectItem>
                    <SelectItem value="trivia">トリビア</SelectItem>
                    <SelectItem value="story">ストーリー</SelectItem>
                    <SelectItem value="tutorial">チュートリアル</SelectItem>
                    <SelectItem value="news">ニュース</SelectItem>
                    <SelectItem value="review">レビュー</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-targetAudience">ターゲットオーディエンス</Label>
              <Input
                id="edit-targetAudience"
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">説明</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <h3 className="font-semibold mb-4">投稿設定</h3>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="skipReview">審査をスキップ</Label>
                    <p className="text-sm text-muted-foreground">
                      AI生成後、審査なしで自動投稿キューに追加
                    </p>
                  </div>
                  <Switch
                    id="skipReview"
                    checked={formData.skipReview || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, skipReview: checked })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-postingFrequency">投稿頻度</Label>
                  <Select
                    value={formData.postingFrequency}
                    onValueChange={(value: any) => setFormData({ ...formData, postingFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">1日1回</SelectItem>
                      <SelectItem value="twice_daily">1日2回</SelectItem>
                      <SelectItem value="three_times_daily">1日3回</SelectItem>
                      <SelectItem value="weekly">週1回</SelectItem>
                      <SelectItem value="custom">カスタム</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>投稿時間帯</Label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={scheduleTimeSlot}
                      onChange={(e) => setScheduleTimeSlot(e.target.value)}
                    />
                    <Button type="button" onClick={handleAddTimeSlot} variant="outline">
                      追加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.postingTimeSlots || []).map((slot) => (
                      <Badge key={slot} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTimeSlot(slot)}>
                        {slot} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={isAIGenerateDialogOpen} onOpenChange={setIsAIGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI自動生成</DialogTitle>
            <DialogDescription>
              AIが自動的に複数のSNSエージェントを生成します
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-count">生成数 (1-20)</Label>
              <Input
                id="ai-count"
                type="number"
                min="1"
                max="20"
                value={aiGenCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 20) {
                    setAiGenCount(val);
                  } else if (e.target.value === '') {
                    setAiGenCount(1);
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-industry">業界 (オプション)</Label>
              <Input
                id="ai-industry"
                value={aiGenIndustry}
                onChange={(e) => setAiGenIndustry(e.target.value)}
                placeholder="例: テクノロジー、ファッション、フード"
              />
            </div>
            <div className="grid gap-2">
              <Label>ターゲットプラットフォーム (オプション)</Label>
              <div className="flex flex-wrap gap-2">
                {["twitter", "instagram", "facebook", "tiktok"].map((platform) => (
                  <Badge
                    key={platform}
                    variant={aiGenPlatforms.includes(platform) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (aiGenPlatforms.includes(platform)) {
                        setAiGenPlatforms(aiGenPlatforms.filter(p => p !== platform));
                      } else {
                        setAiGenPlatforms([...aiGenPlatforms, platform]);
                      }
                    }}
                  >
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAIGenerateDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAIGenerate} disabled={generateAgentsMutation.isPending}>
              {generateAgentsMutation.isPending ? "生成中..." : "生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
