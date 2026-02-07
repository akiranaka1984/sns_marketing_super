import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Bot, 
  ArrowLeft, 
  Play, 
  Plus, 
  Trash2, 
  Brain, 
  Shield, 
  Link2, 
  History,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  BarChart3,
  RefreshCw,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import AutoOptimizationSettings from "@/components/AutoOptimizationSettings";

// Knowledge types with Japanese labels
const knowledgeTypes = [
  { value: "success_pattern", label: "成功パターン", icon: CheckCircle, color: "text-green-500" },
  { value: "failure_pattern", label: "失敗パターン", icon: XCircle, color: "text-red-500" },
  { value: "content_template", label: "コンテンツテンプレート", icon: Lightbulb, color: "text-yellow-500" },
  { value: "hashtag_strategy", label: "ハッシュタグ戦略", icon: Zap, color: "text-blue-500" },
  { value: "timing_insight", label: "タイミングの知見", icon: Clock, color: "text-purple-500" },
  { value: "audience_insight", label: "オーディエンスの知見", icon: Bot, color: "text-pink-500" },
  { value: "engagement_tactic", label: "エンゲージメント戦術", icon: Zap, color: "text-orange-500" },
  { value: "general", label: "一般的な知見", icon: Brain, color: "text-gray-500" },
];

// Rule types with Japanese labels
const ruleTypes = [
  { value: "forbidden_word", label: "禁止ワード" },
  { value: "required_element", label: "必須要素" },
  { value: "content_limit", label: "コンテンツ制限" },
  { value: "posting_limit", label: "投稿制限" },
  { value: "time_restriction", label: "時間制限" },
  { value: "platform_specific", label: "プラットフォーム固有" },
  { value: "tone_guideline", label: "トーンガイドライン" },
  { value: "custom", label: "カスタム" },
];

export default function AgentDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const agentId = parseInt(params.id || "0");

  // Dialog states
  const [isAddKnowledgeOpen, setIsAddKnowledgeOpen] = useState(false);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isLinkAccountOpen, setIsLinkAccountOpen] = useState(false);

  // Form states
  const [knowledgeForm, setKnowledgeForm] = useState({
    knowledgeType: "general" as const,
    title: "",
    content: "",
    confidence: 50,
  });

  const [ruleForm, setRuleForm] = useState({
    ruleType: "forbidden_word" as const,
    ruleName: "",
    ruleValue: "",
    priority: 50,
  });

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: agent, isLoading: agentLoading } = trpc.agents.getById.useQuery(
    { id: agentId },
    { enabled: agentId > 0 }
  );

  const { data: knowledge = [] } = trpc.agents.getKnowledge.useQuery(
    { agentId },
    { enabled: agentId > 0 }
  );

  const { data: rules = [] } = trpc.agents.getRules.useQuery(
    { agentId },
    { enabled: agentId > 0 }
  );

  const { data: linkedAccounts = [] } = trpc.agents.getLinkedAccounts.useQuery(
    { agentId },
    { enabled: agentId > 0 }
  );

  const { data: executionLogs = [] } = trpc.agents.getExecutionLogs.useQuery(
    { agentId, limit: 20 },
    { enabled: agentId > 0 }
  );

  const { data: collectorStatus } = trpc.engagementCollector.getStatus.useQuery();

  const { data: allAccounts = [] } = trpc.accounts.list.useQuery();

  // Mutations
  // Engagement collector mutations
  const collectAllMutation = trpc.engagementCollector.collectAll.useMutation({
    onSuccess: (result) => {
      toast.success(`エンゲージメント収集完了: ${result.success}/${result.total}件成功`);
      utils.agents.getKnowledge.invalidate({ agentId });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const updateConfidenceMutation = trpc.engagementCollector.updateConfidence.useMutation({
    onSuccess: () => {
      toast.success("知見の信頼度を更新しました");
      utils.agents.getKnowledge.invalidate({ agentId });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const startCollectorMutation = trpc.engagementCollector.startCollector.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("自動収集を開始しました");
      } else {
        toast.info(result.message);
      }
      utils.engagementCollector.getStatus.invalidate();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const stopCollectorMutation = trpc.engagementCollector.stopCollector.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("自動収集を停止しました");
      } else {
        toast.info(result.message);
      }
      utils.engagementCollector.getStatus.invalidate();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const generateScheduledPostsMutation = trpc.agentScheduledPosts.generate.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.postsCreated}件のスケジュール投稿を生成しました`);
        utils.agents.getExecutionLogs.invalidate({ agentId });
      } else {
        toast.error("スケジュール投稿の生成に失敗しました: " + result.error);
      }
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const runAgentMutation = trpc.agents.run.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("エージェントが実行されました。投稿ID: " + result.postId);
        utils.agents.getExecutionLogs.invalidate({ agentId });
      } else {
        toast.error("実行に失敗しました: " + result.error);
      }
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const addKnowledgeMutation = trpc.agents.addKnowledge.useMutation({
    onSuccess: () => {
      toast.success("知見が追加されました。");
      utils.agents.getKnowledge.invalidate({ agentId });
      setIsAddKnowledgeOpen(false);
      setKnowledgeForm({ knowledgeType: "general", title: "", content: "", confidence: 50 });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const deleteKnowledgeMutation = trpc.agents.deleteKnowledge.useMutation({
    onSuccess: () => {
      toast.success("知見が削除されました。");
      utils.agents.getKnowledge.invalidate({ agentId });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const addRuleMutation = trpc.agents.addRule.useMutation({
    onSuccess: () => {
      toast.success("ルールが追加されました。");
      utils.agents.getRules.invalidate({ agentId });
      setIsAddRuleOpen(false);
      setRuleForm({ ruleType: "forbidden_word", ruleName: "", ruleValue: "", priority: 50 });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const deleteRuleMutation = trpc.agents.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("ルールが削除されました。");
      utils.agents.getRules.invalidate({ agentId });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const linkAccountMutation = trpc.agents.linkAccount.useMutation({
    onSuccess: () => {
      toast.success("アカウントがリンクされました。");
      utils.agents.getLinkedAccounts.invalidate({ agentId });
      setIsLinkAccountOpen(false);
      setSelectedAccountId(null);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const unlinkAccountMutation = trpc.agents.unlinkAccount.useMutation({
    onSuccess: () => {
      toast.success("アカウントのリンクが解除されました。");
      utils.agents.getLinkedAccounts.invalidate({ agentId });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  const consolidateMutation = trpc.agents.consolidate.useMutation({
    onSuccess: () => {
      toast.success("知見の統合が完了しました。");
      utils.agents.getKnowledge.invalidate({ agentId });
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    },
  });

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">エージェントが見つかりません</h1>
          <Button onClick={() => setLocation("/agents")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            エージェント一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  const getKnowledgeTypeInfo = (type: string) => {
    return knowledgeTypes.find(k => k.value === type) || knowledgeTypes[knowledgeTypes.length - 1];
  };

  const getRuleTypeLabel = (type: string) => {
    return ruleTypes.find(r => r.value === type)?.label || type;
  };

  // Available accounts (not already linked)
  const linkedAccountIds = linkedAccounts.map((la: any) => la.accountId);
  const availableAccounts = allAccounts.filter((a: any) => !linkedAccountIds.includes(a.id));

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => setLocation("/agents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <p className="text-muted-foreground">{agent.theme}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => generateScheduledPostsMutation.mutate({ agentId, count: 5 })}
            disabled={generateScheduledPostsMutation.isPending || linkedAccounts.length === 0}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {generateScheduledPostsMutation.isPending ? "生成中..." : "スケジュール投稿を生成"}
          </Button>
          <Button 
            onClick={() => runAgentMutation.mutate({ agentId })}
            disabled={runAgentMutation.isPending || linkedAccounts.length === 0}
          >
            <Play className="mr-2 h-4 w-4" />
            {runAgentMutation.isPending ? "実行中..." : "今すぐ実行"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{agent.knowledgeCount || 0}</p>
                <p className="text-sm text-muted-foreground">蓄積された知見</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{agent.rulesCount || 0}</p>
                <p className="text-sm text-muted-foreground">設定されたルール</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{linkedAccounts.length}</p>
                <p className="text-sm text-muted-foreground">リンクされたアカウント</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{executionLogs.length}</p>
                <p className="text-sm text-muted-foreground">実行履歴</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="knowledge" className="space-y-4">
        <TabsList>
          <TabsTrigger value="knowledge">
            <Brain className="mr-2 h-4 w-4" />
            知見
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Shield className="mr-2 h-4 w-4" />
            ルール
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Link2 className="mr-2 h-4 w-4" />
            アカウント
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="mr-2 h-4 w-4" />
            実行履歴
          </TabsTrigger>
          <TabsTrigger value="engagement">
            <BarChart3 className="mr-2 h-4 w-4" />
            エンゲージメント
          </TabsTrigger>
          <TabsTrigger value="optimization">
            <Zap className="mr-2 h-4 w-4" />
            AI最適化
          </TabsTrigger>
        </TabsList>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>蓄積された知見</CardTitle>
                  <CardDescription>
                    エージェントが学習した成功パターン、失敗パターン、コンテンツテンプレートなど
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => consolidateMutation.mutate({ agentId })}
                    disabled={consolidateMutation.isPending}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    知見を統合
                  </Button>
                  <Button onClick={() => setIsAddKnowledgeOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    知見を追加
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {knowledge.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  まだ知見がありません。エージェントを実行すると自動的に学習します。
                </div>
              ) : (
                <div className="space-y-4">
                  {knowledge.map((k: any) => {
                    const typeInfo = getKnowledgeTypeInfo(k.knowledgeType);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <div key={k.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <TypeIcon className={`h-5 w-5 mt-1 ${typeInfo.color}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{k.title}</h4>
                                <Badge variant="outline">{typeInfo.label}</Badge>
                                <Badge variant="secondary">信頼度: {k.confidence}%</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{k.content}</p>
                              {k.usageCount > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  使用回数: {k.usageCount} | 成功率: {k.successRate}%
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteKnowledgeMutation.mutate({ id: k.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>ルール設定</CardTitle>
                  <CardDescription>
                    エージェントの行動を制御するルールと制約
                  </CardDescription>
                </div>
                <Button onClick={() => setIsAddRuleOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  ルールを追加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  まだルールが設定されていません。
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((r: any) => (
                    <div key={r.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{r.ruleName}</h4>
                            <Badge variant="outline">{getRuleTypeLabel(r.ruleType)}</Badge>
                            <Badge variant="secondary">優先度: {r.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{r.ruleValue}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteRuleMutation.mutate({ id: r.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>リンクされたアカウント</CardTitle>
                  <CardDescription>
                    このエージェントが投稿に使用するSNSアカウント
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setIsLinkAccountOpen(true)}
                  disabled={availableAccounts.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  アカウントをリンク
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {linkedAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p>アカウントがリンクされていません。</p>
                  <p className="text-sm">エージェントを実行するにはアカウントをリンクしてください。</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {linkedAccounts.map((la: any) => (
                    <div key={la.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge>{la.account?.platform}</Badge>
                          <span className="font-medium">@{la.account?.username}</span>
                          {la.account?.deviceId && (
                            <span className="text-sm text-muted-foreground">
                              デバイス: {la.account.deviceId}
                            </span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => unlinkAccountMutation.mutate({ 
                            agentId, 
                            accountId: la.accountId 
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>実行履歴</CardTitle>
              <CardDescription>
                エージェントの実行ログと結果
              </CardDescription>
            </CardHeader>
            <CardContent>
              {executionLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  まだ実行履歴がありません。
                </div>
              ) : (
                <div className="space-y-4">
                  {executionLogs.map((log: any) => (
                    <div key={log.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {log.status === "success" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : log.status === "failed" ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                          <div>
                            <p className="font-medium">
                              {log.executionType === "content_generation" && "コンテンツ生成"}
                              {log.executionType === "post_execution" && "投稿実行"}
                              {log.executionType === "learning" && "学習"}
                              {log.executionType === "analysis" && "分析"}
                              {log.executionType === "optimization" && "最適化"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString("ja-JP")}
                              {log.executionTimeMs && ` (${log.executionTimeMs}ms)`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {log.postId && (
                            <Badge variant="outline">投稿ID: {log.postId}</Badge>
                          )}
                          {log.errorMessage && (
                            <p className="text-sm text-red-500 mt-1">{log.errorMessage}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>エンゲージメント収集</CardTitle>
                  <CardDescription>
                    投稿のエンゲージメント（いいね数・コメント数など）を自動収集し、知見の精度を向上させます
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => collectAllMutation.mutate()}
                    disabled={collectAllMutation.isPending}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${collectAllMutation.isPending ? 'animate-spin' : ''}`} />
                    今すぐ収集
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateConfidenceMutation.mutate({ agentId })}
                    disabled={updateConfidenceMutation.isPending}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    信頼度更新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Auto Collection Status */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">自動収集スケジューラー</h4>
                      <p className="text-sm text-muted-foreground">
                        投稿後1時間、6時間、24時間、48時間で自動的にエンゲージメントを収集します
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={collectorStatus?.isRunning ? "default" : "secondary"}>
                        {collectorStatus?.isRunning ? "実行中" : "停止中"}
                      </Badge>
                      {collectorStatus?.isRunning ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => stopCollectorMutation.mutate()}
                          disabled={stopCollectorMutation.isPending}
                        >
                          停止
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => startCollectorMutation.mutate()}
                          disabled={startCollectorMutation.isPending}
                        >
                          開始
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collection Schedule Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <p className="font-medium">1時間後</p>
                    <p className="text-sm text-muted-foreground">初期反応を取得</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">6時間後</p>
                    <p className="text-sm text-muted-foreground">中間反応を取得</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                    <p className="font-medium">24時間後</p>
                    <p className="text-sm text-muted-foreground">知見生成開始</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <p className="font-medium">48時間後</p>
                    <p className="text-sm text-muted-foreground">最終分析</p>
                  </div>
                </div>

                {/* How it works */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">エンゲージメント収集の仕組み</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• 投稿後、設定された時間に自動でエンゲージメントを取得します</li>
                    <li>• 取得したデータは投稿のパフォーマンス分析に使用されます</li>
                    <li>• 高パフォーマンスの投稿から成功パターンを抽出し、知見として蓄積します</li>
                    <li>• 低パフォーマンスの投稿からは失敗パターンを学習し、改善に活かします</li>
                    <li>• 知見の信頼度は、実際の投稿結果に基づいて自動的に更新されます</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization">
          <AutoOptimizationSettings agentId={agentId} />
        </TabsContent>
      </Tabs>

      {/* Add Knowledge Dialog */}
      <Dialog open={isAddKnowledgeOpen} onOpenChange={setIsAddKnowledgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>知見を追加</DialogTitle>
            <DialogDescription>
              エージェントに新しい知見を教えます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>知見タイプ</Label>
              <Select
                value={knowledgeForm.knowledgeType}
                onValueChange={(v: any) => setKnowledgeForm({ ...knowledgeForm, knowledgeType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {knowledgeTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>タイトル</Label>
              <Input
                value={knowledgeForm.title}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                placeholder="例: 朝の投稿は反応が良い"
              />
            </div>
            <div>
              <Label>内容</Label>
              <Textarea
                value={knowledgeForm.content}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                placeholder="詳細な説明を入力..."
                rows={4}
              />
            </div>
            <div>
              <Label>信頼度 ({knowledgeForm.confidence}%)</Label>
              <Input
                type="range"
                min="0"
                max="100"
                value={knowledgeForm.confidence}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, confidence: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddKnowledgeOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={() => addKnowledgeMutation.mutate({ agentId, ...knowledgeForm })}
              disabled={!knowledgeForm.title || !knowledgeForm.content}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rule Dialog */}
      <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ルールを追加</DialogTitle>
            <DialogDescription>
              エージェントの行動を制御するルールを設定します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ルールタイプ</Label>
              <Select
                value={ruleForm.ruleType}
                onValueChange={(v: any) => setRuleForm({ ...ruleForm, ruleType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ruleTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ルール名</Label>
              <Input
                value={ruleForm.ruleName}
                onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })}
                placeholder="例: 競合他社名の使用禁止"
              />
            </div>
            <div>
              <Label>ルール値</Label>
              <Textarea
                value={ruleForm.ruleValue}
                onChange={(e) => setRuleForm({ ...ruleForm, ruleValue: e.target.value })}
                placeholder="例: 「A社」「B社」という単語を使用しない"
                rows={4}
              />
            </div>
            <div>
              <Label>優先度 ({ruleForm.priority})</Label>
              <Input
                type="range"
                min="0"
                max="100"
                value={ruleForm.priority}
                onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRuleOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={() => addRuleMutation.mutate({ agentId, ...ruleForm })}
              disabled={!ruleForm.ruleName || !ruleForm.ruleValue}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Account Dialog */}
      <Dialog open={isLinkAccountOpen} onOpenChange={setIsLinkAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アカウントをリンク</DialogTitle>
            <DialogDescription>
              エージェントが投稿に使用するアカウントを選択します。Playwrightブラウザ自動化で投稿が実行されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>アカウント</Label>
              <Select
                value={selectedAccountId?.toString() || ""}
                onValueChange={(v) => setSelectedAccountId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="アカウントを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts.map((account: any) => (
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
              {selectedAccountId && !availableAccounts.find((a: any) => a.id === selectedAccountId)?.deviceId && (
                <p className="text-sm text-destructive mt-2">
                  ※ このアカウントにはPlaywrightセッションが設定されていません。アカウント詳細ページで設定を行ってください。
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkAccountOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={() => selectedAccountId && linkAccountMutation.mutate({ agentId, accountId: selectedAccountId })}
              disabled={!selectedAccountId}
            >
              リンク
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
