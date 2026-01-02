import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FlaskConical, 
  Plus, 
  Play, 
  BarChart3, 
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Lightbulb,
  Eye
} from "lucide-react";
import { Link } from "wouter";

export default function ABTesting() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewVariations, setPreviewVariations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    agentId: 0,
    name: "",
    theme: "",
    variationCount: 2,
    testDurationHours: 48
  });

  const utils = trpc.useUtils();
  const { data: tests = [] } = trpc.abTesting.list.useQuery();
  const { data: agents = [] } = trpc.agents.list.useQuery();
  const { data: learnings = [] } = trpc.abTesting.getLearnings.useQuery();

  const createMutation = trpc.abTesting.create.useMutation({
    onSuccess: () => {
      toast.success("A/Bテストを作成しました");
      setIsCreateOpen(false);
      setFormData({ agentId: 0, name: "", theme: "", variationCount: 2, testDurationHours: 48 });
      utils.abTesting.list.invalidate();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    }
  });

  const startMutation = trpc.abTesting.start.useMutation({
    onSuccess: () => {
      toast.success("A/Bテストを開始しました");
      utils.abTesting.list.invalidate();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    }
  });

  const analyzeMutation = trpc.abTesting.analyze.useMutation({
    onSuccess: (result) => {
      if (result.winnerId) {
        toast.success(`分析完了！信頼度: ${result.confidence}%`);
      } else {
        toast.info("まだ十分なデータがありません");
      }
      utils.abTesting.list.invalidate();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    }
  });

  const extractLearningsMutation = trpc.abTesting.extractLearnings.useMutation({
    onSuccess: () => {
      toast.success("学習を抽出しました");
      utils.abTesting.getLearnings.invalidate();
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    }
  });

  const previewMutation = trpc.abTesting.previewVariations.useMutation({
    onSuccess: (result) => {
      setPreviewVariations(result.variations);
      setIsPreviewOpen(true);
    },
    onError: (error) => {
      toast.error("エラー: " + error.message);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">下書き</Badge>;
      case "running":
        return <Badge variant="default" className="bg-blue-500">実行中</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500">完了</Badge>;
      case "cancelled":
        return <Badge variant="destructive">キャンセル</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLearningTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      tone_preference: "トーン",
      length_preference: "長さ",
      emoji_preference: "絵文字",
      hashtag_preference: "ハッシュタグ",
      media_preference: "メディア",
      timing_preference: "タイミング",
      general: "一般"
    };
    return labels[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-8 w-8" />
              A/Bテスト
            </h1>
            <p className="text-muted-foreground mt-1">
              異なるスタイルの投稿を比較し、最も効果的なパターンを発見
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新規テスト
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <FlaskConical className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{tests.length}</p>
                  <p className="text-sm text-muted-foreground">総テスト数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Play className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {tests.filter((t: any) => t.status === "running").length}
                  </p>
                  <p className="text-sm text-muted-foreground">実行中</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {tests.filter((t: any) => t.status === "completed").length}
                  </p>
                  <p className="text-sm text-muted-foreground">完了</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Lightbulb className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{learnings.length}</p>
                  <p className="text-sm text-muted-foreground">獲得した学習</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tests List */}
        <Card>
          <CardHeader>
            <CardTitle>テスト一覧</CardTitle>
            <CardDescription>
              作成したA/Bテストの管理と結果の確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>まだA/Bテストがありません</p>
                <p className="text-sm mt-1">新規テストを作成して、最適な投稿スタイルを見つけましょう</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tests.map((test: any) => (
                  <div key={test.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{test.name}</h3>
                          {getStatusBadge(test.status)}
                          {test.winnerId && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <Trophy className="h-3 w-3 mr-1" />
                              勝者決定
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          テーマ: {test.theme}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>バリエーション: {test.variationCount}個</span>
                          <span>期間: {test.testDurationHours}時間</span>
                          {test.confidenceLevel && (
                            <span>信頼度: {test.confidenceLevel}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {test.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => startMutation.mutate({ testId: test.id })}
                            disabled={startMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            開始
                          </Button>
                        )}
                        {test.status === "running" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => analyzeMutation.mutate({ testId: test.id })}
                            disabled={analyzeMutation.isPending}
                          >
                            <BarChart3 className="h-4 w-4 mr-1" />
                            分析
                          </Button>
                        )}
                        {test.status === "completed" && !test.winnerId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => analyzeMutation.mutate({ testId: test.id })}
                            disabled={analyzeMutation.isPending}
                          >
                            <BarChart3 className="h-4 w-4 mr-1" />
                            結果確認
                          </Button>
                        )}
                        {test.status === "completed" && test.winnerId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => extractLearningsMutation.mutate({ testId: test.id })}
                            disabled={extractLearningsMutation.isPending}
                          >
                            <Lightbulb className="h-4 w-4 mr-1" />
                            学習抽出
                          </Button>
                        )}
                        <Link href={`/ab-testing/${test.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Learnings */}
        {learnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                獲得した学習
              </CardTitle>
              <CardDescription>
                A/Bテストから抽出されたインサイト
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {learnings.slice(0, 5).map((learning: any) => (
                  <div key={learning.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{getLearningTypeLabel(learning.learningType)}</Badge>
                          <span className="font-medium">{learning.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{learning.insight}</p>
                      </div>
                      <Badge variant={learning.isApplied ? "default" : "secondary"}>
                        {learning.isApplied ? "適用済み" : `信頼度: ${learning.confidence}%`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Test Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新規A/Bテスト作成</DialogTitle>
            <DialogDescription>
              同じテーマで異なるスタイルの投稿を比較します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>エージェント</Label>
              <Select
                value={formData.agentId.toString()}
                onValueChange={(v) => setFormData({ ...formData, agentId: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="エージェントを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>テスト名</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: 朝の挨拶投稿スタイル比較"
              />
            </div>
            <div>
              <Label>テーマ</Label>
              <Textarea
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                placeholder="例: 月曜日の朝、フォロワーに元気を与える挨拶"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>バリエーション数</Label>
                <Select
                  value={formData.variationCount.toString()}
                  onValueChange={(v) => setFormData({ ...formData, variationCount: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}個
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>テスト期間</Label>
                <Select
                  value={formData.testDurationHours.toString()}
                  onValueChange={(v) => setFormData({ ...formData, testDurationHours: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24時間</SelectItem>
                    <SelectItem value="48">48時間</SelectItem>
                    <SelectItem value="72">72時間</SelectItem>
                    <SelectItem value="168">1週間</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => previewMutation.mutate({
                theme: formData.theme,
                count: formData.variationCount
              })}
              disabled={!formData.theme || previewMutation.isPending}
            >
              <Eye className="mr-2 h-4 w-4" />
              バリエーションをプレビュー
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.agentId || !formData.name || !formData.theme || createMutation.isPending}
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>バリエーションプレビュー</DialogTitle>
            <DialogDescription>
              生成されるバリエーションの例
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewVariations.map((v, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>バリエーション {v.variationName}</Badge>
                  <Badge variant="outline">{v.config.tone}</Badge>
                  <Badge variant="outline">{v.config.contentLength}</Badge>
                  <Badge variant="outline">絵文字: {v.config.emojiUsage}</Badge>
                </div>
                <p className="text-sm">{v.content}</p>
                {v.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {v.hashtags.map((tag: string, j: number) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
