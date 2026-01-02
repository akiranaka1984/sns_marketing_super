import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, TrendingUp, Lightbulb, Target, Sparkles, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function WeeklyReview() {
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [generatedReview, setGeneratedReview] = useState<any>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);

  const { data: agents } = trpc.agents.list.useQuery();

  const generateReview = trpc.weeklyReview.generateReview.useMutation({
    onSuccess: (data) => {
      toast.success("週次レビューを生成しました");
      setGeneratedReview(data);
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const autoOptimizeMutation = trpc.weeklyReview.autoOptimize.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setOptimizationResult(data);
    },
    onError: (error: any) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleGenerateReview = () => {
    if (!weekStartDate || !weekEndDate) {
      toast.error("期間を選択してください");
      return;
    }

    generateReview.mutate({
      weekStartDate: new Date(weekStartDate),
      weekEndDate: new Date(weekEndDate),
    });
  };

  const handleAutoOptimize = (autoApply: boolean) => {
    if (!selectedAgentId) {
      toast.error("エージェントを選択してください");
      return;
    }

    autoOptimizeMutation.mutate({
      agentId: selectedAgentId,
      daysBack: 7,
      autoApply,
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">週次レビュー</h1>
        <p className="text-muted-foreground">
          週次のパフォーマンスデータを分析し、AI生成のインサイトと推奨事項を提供します
        </p>
      </div>

      {/* Date Range Selection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>レビュー期間選択</CardTitle>
          <CardDescription>分析したい週の開始日と終了日を選択してください</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日</Label>
              <Input
                id="startDate"
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">終了日</Label>
              <Input
                id="endDate"
                type="date"
                value={weekEndDate}
                onChange={(e) => setWeekEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerateReview}
                disabled={generateReview.isPending}
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {generateReview.isPending ? "生成中..." : "レビュー生成"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Auto-Optimization */}
      <Card className="mb-8 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle>AI自動最適化</CardTitle>
          </div>
          <CardDescription>
            エージェントの投稿パフォーマンスを分析し、戦略を自動最適化します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent">対象エージェント</Label>
              <Select
                value={selectedAgentId?.toString()}
                onValueChange={(value) => setSelectedAgentId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="エージェントを選択" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleAutoOptimize(false)}
                disabled={autoOptimizeMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                {autoOptimizeMutation.isPending ? "分析中..." : "提案のみ生成"}
              </Button>
              <Button
                onClick={() => handleAutoOptimize(true)}
                disabled={autoOptimizeMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Zap className="mr-2 h-4 w-4" />
                {autoOptimizeMutation.isPending ? "実行中..." : "自動最適化実行"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Results */}
      {optimizationResult && optimizationResult.success && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>最適化結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Analysis Summary */}
              {optimizationResult.analysis && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">分析投稿数</p>
                    <p className="text-2xl font-bold">{optimizationResult.analysis.totalPosts}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">平均エンゲージメント率</p>
                    <p className="text-2xl font-bold">{optimizationResult.analysis.avgEngagementRate.toFixed(2)}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">インサイト数</p>
                    <p className="text-2xl font-bold">{optimizationResult.analysis.insightsCount}</p>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {optimizationResult.suggestions && optimizationResult.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">最適化提案</h3>
                  {optimizationResult.suggestions.map((suggestion: any, index: number) => (
                    <Card key={index} className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">{suggestion.title}</h4>
                            <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline">
                                期待改善: +{suggestion.expectedImprovement}%
                              </Badge>
                              <Badge variant="secondary">
                                信頼度: {suggestion.confidence}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Applied Results */}
              {optimizationResult.applied && (
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-900">
                    ✅ {optimizationResult.applied.applied}件の最適化を適用しました
                  </p>
                  {optimizationResult.applied.failed > 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      ⚠️ {optimizationResult.applied.failed}件の適用に失敗しました
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Review */}
      {generatedReview && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">総投稿数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{generatedReview.totalPosts}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">総視聴数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {generatedReview.totalViews?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">総いいね</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {generatedReview.totalLikes?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">平均エンゲージメント率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {generatedReview.avgEngagement?.toFixed(2) || 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          {generatedReview.insights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  AIインサイト
                </CardTitle>
                <CardDescription>AIが分析したパフォーマンスの洞察</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {generatedReview.insights.topPerformingContent && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        トップパフォーマンスコンテンツ
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {generatedReview.insights.topPerformingContent}
                      </p>
                    </div>
                  )}
                  {generatedReview.insights.engagementTrends && (
                    <div>
                      <h4 className="font-semibold mb-2">エンゲージメントトレンド</h4>
                      <p className="text-sm text-muted-foreground">
                        {generatedReview.insights.engagementTrends}
                      </p>
                    </div>
                  )}
                  {generatedReview.insights.audienceBehavior && (
                    <div>
                      <h4 className="font-semibold mb-2">オーディエンス行動</h4>
                      <p className="text-sm text-muted-foreground">
                        {generatedReview.insights.audienceBehavior}
                      </p>
                    </div>
                  )}
                  {generatedReview.insights.contentGaps && (
                    <div>
                      <h4 className="font-semibold mb-2">コンテンツギャップ</h4>
                      <p className="text-sm text-muted-foreground">
                        {generatedReview.insights.contentGaps}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {generatedReview.recommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  推奨事項
                </CardTitle>
                <CardDescription>次週に向けた改善提案</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {generatedReview.recommendations.contentStrategy && generatedReview.recommendations.contentStrategy.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">コンテンツ戦略</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {generatedReview.recommendations.contentStrategy.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedReview.recommendations.postingSchedule && generatedReview.recommendations.postingSchedule.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">投稿スケジュール</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {generatedReview.recommendations.postingSchedule.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedReview.recommendations.engagementTactics && generatedReview.recommendations.engagementTactics.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">エンゲージメント戦術</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {generatedReview.recommendations.engagementTactics.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {generatedReview.recommendations.platformOptimization && generatedReview.recommendations.platformOptimization.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">プラットフォーム最適化</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {generatedReview.recommendations.platformOptimization.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!generatedReview && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              期間を選択してレビューを生成してください
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
