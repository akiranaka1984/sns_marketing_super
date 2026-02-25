import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
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
import { Bot, Plus, Edit, Trash2, User, Sparkles, Clock, ToggleLeft, ToggleRight, ExternalLink, Loader2 } from "lucide-react";
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
      formal: "フォーマル", casual: "カジュアル", friendly: "フレンドリー",
      professional: "プロフェッショナル", humorous: "ユーモラス",
    };
    return labels[tone] || tone;
  };

  const getStyleLabel = (style: string) => {
    const labels: Record<string, string> = {
      ranking: "ランキング", trivia: "トリビア", story: "ストーリー",
      tutorial: "チュートリアル", news: "ニュース", review: "レビュー",
    };
    return labels[style] || style;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: "1日1回", twice_daily: "1日2回", three_times_daily: "1日3回",
      weekly: "週1回", custom: "カスタム",
    };
    return labels[freq] || freq;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
          <span className="text-sm text-[#6B6B6B] font-bold">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // Reusable agent form
  const AgentFormFields = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name" className="font-bold">エージェント名 *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="例: テクノロジーレビュアー"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="theme" className="font-bold">テーマ *</Label>
        <Input
          id="theme"
          value={formData.theme}
          onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
          placeholder="例: 最新のスマートフォンとガジェットの詳細レビュー"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label className="font-bold">トーン</Label>
          <Select value={formData.tone} onValueChange={(value: any) => setFormData({ ...formData, tone: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Label className="font-bold">スタイル</Label>
          <Select value={formData.style} onValueChange={(value: any) => setFormData({ ...formData, style: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
        <Label className="font-bold">ターゲットオーディエンス</Label>
        <Input
          value={formData.targetAudience}
          onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
          placeholder="例: 20-40歳のテクノロジー愛好家"
        />
      </div>
      <div className="grid gap-2">
        <Label className="font-bold">説明</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="エージェントの特徴や目的を入力"
          rows={3}
        />
      </div>
      <div className="border-t-2 border-[#1A1A1A] pt-4 mt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B] mb-4">投稿設定</p>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-bold">審査をスキップ</Label>
              <p className="text-xs text-[#6B6B6B] font-bold">AI生成後、審査なしで自動投稿キューに追加</p>
            </div>
            <Switch
              checked={formData.skipReview || false}
              onCheckedChange={(checked) => setFormData({ ...formData, skipReview: checked })}
            />
          </div>
          <div className="grid gap-2">
            <Label className="font-bold">投稿頻度</Label>
            <Select value={formData.postingFrequency} onValueChange={(value: any) => setFormData({ ...formData, postingFrequency: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label className="font-bold">投稿時間帯</Label>
            <div className="flex gap-2">
              <Input type="time" value={scheduleTimeSlot} onChange={(e) => setScheduleTimeSlot(e.target.value)} />
              <Button type="button" onClick={handleAddTimeSlot} variant="outline" size="sm" className="border-2 border-[#1A1A1A] font-bold">追加</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(formData.postingTimeSlots || []).map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleRemoveTimeSlot(slot)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#FFFDF7] text-[#6B6B6B] border-2 border-[#1A1A1A] hover:bg-red-50 hover:text-red-600 hover:border-red-600 transition-colors"
                >
                  {slot} ×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="fade-in-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="section-label mb-1 font-bold">Agents</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A1A]">
            {t('agents.title')}
          </h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5 font-bold">{t('agents.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAIGenerateDialogOpen(true)}
            className="h-8 text-xs font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#FFF8DC] shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-[#FFD700]" />
            AI自動生成
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-8 text-xs font-bold bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            新規作成
          </Button>
        </div>
      </div>

      {/* Agents List */}
      <div className="space-y-2.5">
        {agents.length === 0 ? (
          <div className="fade-in-up border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]" style={{ animationDelay: '80ms' }}>
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-lg bg-[#FFD700] mb-4 border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                <Bot className="h-8 w-8 text-[#1A1A1A]" />
              </div>
              <h3 className="text-base font-bold text-[#1A1A1A] mb-1">エージェントがありません</h3>
              <p className="text-xs text-[#6B6B6B] text-center mb-5 max-w-sm font-bold">
                AI自動生成または手動でエージェントを作成してください
              </p>
            </div>
          </div>
        ) : (
          agents.map((agent: any, idx: number) => {
            const timeSlots = agent.postingTimeSlots
              ? (typeof agent.postingTimeSlots === "string"
                  ? JSON.parse(agent.postingTimeSlots)
                  : agent.postingTimeSlots)
              : [];

            return (
              <div
                key={agent.id}
                className={`fade-in-up border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] overflow-hidden transition-all ${!agent.isActive ? "opacity-50" : ""} bg-[#FFFDF7]`}
                style={{ animationDelay: `${(idx + 1) * 40}ms` }}
              >
                <div className="flex items-stretch">
                  {/* Left accent */}
                  <div className={`w-1 flex-shrink-0 ${agent.isActive ? 'bg-[#A8E6CF]' : 'bg-[#6B6B6B]'}`} />

                  {/* Content */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#4ECDC4] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
                            <Bot className="h-4 w-4 text-[#1A1A1A]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-[#1A1A1A] truncate">{agent.name}</h3>
                            <p className="text-[11px] text-[#6B6B6B] truncate font-bold">{agent.theme}</p>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#87CEEB] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                            {getToneLabel(agent.tone)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]">
                            {getStyleLabel(agent.style)}
                          </span>
                          {agent.targetAudience && (
                            <span className="text-[10px] text-[#6B6B6B] flex items-center gap-0.5 font-bold">
                              <User className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[150px]">{agent.targetAudience}</span>
                            </span>
                          )}
                        </div>

                        {agent.description && (
                          <p className="text-xs text-[#6B6B6B] mt-2 line-clamp-1 font-bold">{agent.description}</p>
                        )}
                      </div>

                      {/* Right: Actions & Schedule */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleToggleActive(agent.id, agent.isActive)}
                            className="p-1.5 rounded-lg hover:bg-[#FFF8DC] transition-colors"
                            title={agent.isActive ? "無効化" : "有効化"}
                          >
                            {agent.isActive ? (
                              <ToggleRight className="h-4 w-4 text-[#A8E6CF]" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-[#6B6B6B]" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(agent)}
                            className="p-1.5 rounded-lg hover:bg-[#FFF8DC] text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(agent.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Schedule */}
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[11px] text-[#6B6B6B] font-bold">
                            <Clock className="h-3 w-3" />
                            <span>{getFrequencyLabel(agent.postingFrequency || "daily")}</span>
                          </div>
                          {timeSlots.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1 mt-1">
                              {timeSlots.slice(0, 3).map((slot: string) => (
                                <span key={slot} className="px-1 py-0 rounded-lg text-[9px] font-mono font-bold text-[#1A1A1A] bg-[#FFD700] border-2 border-[#1A1A1A]">
                                  {slot}
                                </span>
                              ))}
                              {timeSlots.length > 3 && (
                                <span className="px-1 py-0 rounded-lg text-[9px] font-bold text-[#1A1A1A] bg-[#FFD700] border-2 border-[#1A1A1A]">
                                  +{timeSlots.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <Link href={`/agents/${agent.id}`}>
                          <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-[#1A1A1A] bg-[#4ECDC4] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                            <ExternalLink className="h-3 w-3" />
                            詳細
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">新しいSNSエージェントを作成</DialogTitle>
            <DialogDescription className="font-bold">エージェントの詳細情報と投稿スケジュールを入力してください</DialogDescription>
          </DialogHeader>
          <AgentFormFields />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)} className="border-2 border-[#1A1A1A] font-bold">キャンセル</Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] transition-all font-bold">
              {createMutation.isPending ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold">SNSエージェントを編集</DialogTitle>
            <DialogDescription className="font-bold">エージェントの詳細情報と投稿スケジュールを更新してください</DialogDescription>
          </DialogHeader>
          <AgentFormFields />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)} className="border-2 border-[#1A1A1A] font-bold">キャンセル</Button>
            <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending} className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] transition-all font-bold">
              {updateMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={isAIGenerateDialogOpen} onOpenChange={setIsAIGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">AI自動生成</DialogTitle>
            <DialogDescription className="font-bold">AIが自動的に複数のSNSエージェントを生成します</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="font-bold">生成数 (1-20)</Label>
              <Input
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
              <Label className="font-bold">業界 (オプション)</Label>
              <Input
                value={aiGenIndustry}
                onChange={(e) => setAiGenIndustry(e.target.value)}
                placeholder="例: テクノロジー、ファッション、フード"
              />
            </div>
            <div className="grid gap-2">
              <Label className="font-bold">ターゲットプラットフォーム (オプション)</Label>
              <div className="flex flex-wrap gap-1.5">
                {["twitter", "instagram", "facebook", "tiktok"].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => {
                      if (aiGenPlatforms.includes(platform)) {
                        setAiGenPlatforms(aiGenPlatforms.filter(p => p !== platform));
                      } else {
                        setAiGenPlatforms([...aiGenPlatforms, platform]);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border-2 transition-all shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] ${
                      aiGenPlatforms.includes(platform)
                        ? 'bg-[#FFD700] text-[#1A1A1A] border-[#1A1A1A]'
                        : 'bg-[#FFFDF7] text-[#6B6B6B] border-[#1A1A1A]'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAIGenerateDialogOpen(false)} className="border-2 border-[#1A1A1A] font-bold">キャンセル</Button>
            <Button size="sm" onClick={handleAIGenerate} disabled={generateAgentsMutation.isPending} className="bg-[#FFD700] hover:bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-[1px_1px_0_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] transition-all font-bold">
              {generateAgentsMutation.isPending ? "生成中..." : "生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
