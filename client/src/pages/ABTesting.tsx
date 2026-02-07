import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
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
  Eye,
  AlertTriangle,
  TrendingUp,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";

// Statistical analysis result type
interface AnalysisResult {
  winnerId: number | null;
  confidence: number;
  analysis: string;
  statistics: {
    pValue: number | null;
    effectSize: number | null;
    effectSizeInterpretation: string;
    isStatisticallySignificant: boolean;
    confidenceInterval: {
      lower: number;
      upper: number;
    } | null;
    sampleSizeAdequate: boolean;
    requiredSampleSize: number;
    currentSampleSize: number;
    warnings: string[];
  } | null;
}

export default function ABTesting() {
  const { t } = useI18n();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
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
      setAnalysisResult(result as AnalysisResult);
      setIsAnalysisOpen(true);
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
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">下書き</span>;
      case "running":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700">実行中</span>;
      case "completed":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">完了</span>;
      case "cancelled":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700">キャンセル</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{status}</span>;
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
    <>
      <div className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="fade-in-up page-header">
          <div>
            <h1 className="page-title">A/Bテスト</h1>
            <p className="page-subtitle">
              異なるスタイルの投稿を比較し、最も効果的なパターンを発見
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-[#D4380D] hover:bg-[#B8300B] text-white">
            <Plus className="mr-2 h-4 w-4" />
            新規テスト
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#2563EB' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">総テスト数</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{tests.length}</p>
              <p className="text-[10px] text-[#A3A3A3] mt-0.5">全テスト</p>
            </div>
          </div>
          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#059669' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">実行中</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                {tests.filter((t: any) => t.status === "running").length}
              </p>
              <p className="text-[10px] text-[#A3A3A3] mt-0.5">アクティブ</p>
            </div>
          </div>
          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#7C3AED' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">完了</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">
                {tests.filter((t: any) => t.status === "completed").length}
              </p>
              <p className="text-[10px] text-[#A3A3A3] mt-0.5">終了済み</p>
            </div>
          </div>
          <div className="fade-in-up metric-card p-4" style={{ '--metric-color': '#D97706' } as React.CSSProperties}>
            <div className="pl-3">
              <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-wide">獲得した学習</p>
              <p className="text-2xl font-bold text-[#1A1A1A] mt-0.5">{learnings.length}</p>
              <p className="text-[10px] text-[#A3A3A3] mt-0.5">インサイト</p>
            </div>
          </div>
        </div>

        {/* Tests List */}
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">テスト一覧</h3>
          <p className="text-[11px] text-[#A3A3A3] mb-4">
            作成したA/Bテストの管理と結果の確認
          </p>
          {tests.length === 0 ? (
            <div className="text-center py-12 text-[#A3A3A3]">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>まだA/Bテストがありません</p>
              <p className="text-sm mt-1">新規テストを作成して、最適な投稿スタイルを見つけましょう</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tests.map((test: any) => (
                <div key={test.id} className="border border-[#E5E5E5] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{test.name}</h3>
                        {getStatusBadge(test.status)}
                        {test.winnerId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-amber-300 text-amber-700">
                            <Trophy className="h-3 w-3 mr-1" />
                            勝者決定
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#A3A3A3] mt-1">
                        テーマ: {test.theme}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-[#A3A3A3]">
                        <span>バリエーション: {test.variationCount}個</span>
                        <span>期間: {test.testDurationHours}時間</span>
                        {test.confidenceLevel && (
                          <span className="flex items-center gap-1">
                            信頼度: {test.confidenceLevel}%
                            {test.confidenceLevel >= 95 && (
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {test.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => startMutation.mutate({ testId: test.id })}
                          disabled={startMutation.isPending}
                          className="bg-[#D4380D] hover:bg-[#B8300B] text-white"
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
        </div>

        {/* Learnings */}
        {learnings.length > 0 && (
          <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              獲得した学習
            </h3>
            <p className="text-[11px] text-[#A3A3A3] mb-4">
              A/Bテストから抽出されたインサイト
            </p>
            <div className="space-y-3">
              {learnings.slice(0, 5).map((learning: any) => (
                <div key={learning.id} className="border border-[#E5E5E5] rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{getLearningTypeLabel(learning.learningType)}</span>
                        <span className="font-medium">{learning.title}</span>
                      </div>
                      <p className="text-sm text-[#A3A3A3] mt-1">{learning.insight}</p>
                    </div>
                    {learning.isApplied ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">適用済み</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">信頼度: {learning.confidence}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              className="bg-[#D4380D] hover:bg-[#B8300B] text-white"
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
              <div key={i} className="border border-[#E5E5E5] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">バリエーション {v.variationName}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{v.config.tone}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">{v.config.contentLength}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-[#E5E5E5] text-[#737373]">絵文字: {v.config.emojiUsage}</span>
                </div>
                <p className="text-sm">{v.content}</p>
                {v.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {v.hashtags.map((tag: string, j: number) => (
                      <span key={j} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F5F5] text-[#737373]">
                        #{tag}
                      </span>
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

      {/* Analysis Result Dialog */}
      <Dialog open={isAnalysisOpen} onOpenChange={setIsAnalysisOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              分析結果
            </DialogTitle>
            <DialogDescription>
              A/Bテストの統計分析結果
            </DialogDescription>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-6">
              {/* Winner Section */}
              {analysisResult.winnerId ? (
                <div className="border border-[#E5E5E5] rounded-lg p-4 bg-emerald-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold">勝者決定</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700">
                      信頼度: {analysisResult.confidence}%
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{analysisResult.analysis}</p>
                </div>
              ) : (
                <div className="border border-[#E5E5E5] rounded-lg p-4 bg-amber-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold">まだ十分なデータがありません</span>
                  </div>
                </div>
              )}

              {/* Statistical Analysis Section */}
              {analysisResult.statistics && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    統計分析
                  </h4>

                  {/* Significance */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-[#E5E5E5] rounded-lg p-3">
                      <div className="text-sm text-[#A3A3A3]">統計的有意性</div>
                      <div className="flex items-center gap-2 mt-1">
                        {analysisResult.statistics.isStatisticallySignificant ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="font-semibold text-emerald-600">有意 (p &lt; 0.05)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-[#A3A3A3]" />
                            <span className="font-semibold text-[#737373]">有意差なし</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border border-[#E5E5E5] rounded-lg p-3">
                      <div className="text-sm text-[#A3A3A3]">p値</div>
                      <div className="font-semibold mt-1">
                        {analysisResult.statistics.pValue !== null
                          ? analysisResult.statistics.pValue.toFixed(4)
                          : "N/A"}
                      </div>
                    </div>

                    <div className="border border-[#E5E5E5] rounded-lg p-3">
                      <div className="text-sm text-[#A3A3A3]">効果量 (Cohen's d)</div>
                      <div className="font-semibold mt-1">
                        {analysisResult.statistics.effectSize !== null
                          ? `${analysisResult.statistics.effectSize.toFixed(2)} (${analysisResult.statistics.effectSizeInterpretation})`
                          : "N/A"}
                      </div>
                    </div>

                    <div className="border border-[#E5E5E5] rounded-lg p-3">
                      <div className="text-sm text-[#A3A3A3]">信頼区間 (95%)</div>
                      <div className="font-semibold mt-1">
                        {analysisResult.statistics.confidenceInterval
                          ? `[${analysisResult.statistics.confidenceInterval.lower.toFixed(2)}, ${analysisResult.statistics.confidenceInterval.upper.toFixed(2)}]`
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Sample Size Progress */}
                  <div className="border border-[#E5E5E5] rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm text-[#A3A3A3]">サンプルサイズ</div>
                      <div className="text-sm">
                        {analysisResult.statistics.currentSampleSize} / {analysisResult.statistics.requiredSampleSize}
                      </div>
                    </div>
                    <Progress
                      value={Math.min(100, (analysisResult.statistics.currentSampleSize / analysisResult.statistics.requiredSampleSize) * 100)}
                      className="h-2"
                    />
                    {!analysisResult.statistics.sampleSizeAdequate && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        サンプルサイズが不足しています
                      </div>
                    )}
                  </div>

                  {/* Warnings */}
                  {analysisResult.statistics.warnings.length > 0 && (
                    <div className="border border-[#E5E5E5] rounded-lg p-3 bg-amber-50">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-sm">警告</span>
                      </div>
                      <ul className="space-y-1">
                        {analysisResult.statistics.warnings.map((warning, i) => (
                          <li key={i} className="text-sm text-amber-700">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsAnalysisOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
