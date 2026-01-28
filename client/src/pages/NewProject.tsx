import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Target, Calendar, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    objective: "",
    description: "",
    startDate: "",
    endDate: "",
    targetFollowers: "",
    targetEngagementRate: "",
    targetClicks: "",
    targetConversions: "",
    targetUrl: "",
  });
  const [kpiRationale, setKpiRationale] = useState<string | null>(null);

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      toast.success("プロジェクトを作成しました");
      setLocation(`/projects/${data.id}`);
    },
    onError: () => {
      toast.error("プロジェクトの作成に失敗しました");
    },
  });

  const suggestKPIsMutation = trpc.projects.suggestKPIs.useMutation({
    onSuccess: (suggestion) => {
      // Apply suggested KPIs to form
      setFormData(prev => ({
        ...prev,
        targetFollowers: suggestion.followers?.toString() || prev.targetFollowers,
        targetEngagementRate: suggestion.engagement?.toString() || prev.targetEngagementRate,
        targetClicks: suggestion.clicks?.toString() || prev.targetClicks,
        targetConversions: suggestion.conversions?.toString() || prev.targetConversions,
      }));
      setKpiRationale(suggestion.rationale);
      toast.success("AIがKPIを提案しました");
    },
    onError: () => {
      toast.error("KPI提案の取得に失敗しました");
    },
  });

  const handleSuggestKPIs = () => {
    if (!formData.objective.trim()) {
      toast.error("目的を入力してください");
      return;
    }
    suggestKPIsMutation.mutate({ objective: formData.objective });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.objective) {
      toast.error("プロジェクト名と目的は必須です");
      return;
    }

    // Build targets object from form data
    const targets: Record<string, string | number> = {};
    if (formData.targetFollowers) targets.followers = parseInt(formData.targetFollowers);
    if (formData.targetEngagementRate) targets.engagement = parseFloat(formData.targetEngagementRate);
    if (formData.targetClicks) targets.clicks = parseInt(formData.targetClicks);
    if (formData.targetConversions) targets.conversions = parseInt(formData.targetConversions);
    if (formData.targetUrl) targets.url = formData.targetUrl;

    createMutation.mutate({
      name: formData.name,
      objective: formData.objective,
      description: formData.description || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      targets: Object.keys(targets).length > 0 ? targets : undefined,
    });
  };

  return (
    <div className="container max-w-3xl py-8">
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
        <h1 className="text-3xl font-bold text-slate-900">新規プロジェクト作成</h1>
        <p className="text-slate-600 mt-1">マーケティングキャンペーンの基本情報を入力してください</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                基本情報
              </CardTitle>
              <CardDescription>プロジェクトの名前と目的を設定します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">プロジェクト名 *</Label>
                <Input
                  id="name"
                  placeholder="例: 新商品ローンチキャンペーン"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective">目的 *</Label>
                <Textarea
                  id="objective"
                  placeholder="例: 新商品の認知度を高め、初月1000人のフォロワーを獲得する"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">詳細説明（オプション）</Label>
                <Textarea
                  id="description"
                  placeholder="プロジェクトの詳細な説明や背景を記入してください"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Period */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                実施期間
              </CardTitle>
              <CardDescription>プロジェクトの開始日と終了日を設定します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">開始日</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">終了日</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Targets */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    目標設定
                  </CardTitle>
                  <CardDescription>達成したい数値目標を設定します</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestKPIs}
                  disabled={suggestKPIsMutation.isPending || !formData.objective.trim()}
                >
                  {suggestKPIsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AIが提案
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {kpiRationale && (
                <Alert className="mb-4 bg-blue-50 border-blue-200">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>AIの提案理由:</strong> {kpiRationale}
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-slate-600 mb-4">設定したいKPIだけを入力してください（任意）</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetFollowers">目標フォロワー数</Label>
                  <Input
                    id="targetFollowers"
                    type="number"
                    placeholder="例: 1000"
                    value={formData.targetFollowers}
                    onChange={(e) => setFormData({ ...formData, targetFollowers: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetEngagementRate">目標エンゲージメント率 (%)</Label>
                  <Input
                    id="targetEngagementRate"
                    type="number"
                    step="0.1"
                    placeholder="例: 5.5"
                    value={formData.targetEngagementRate}
                    onChange={(e) => setFormData({ ...formData, targetEngagementRate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetClicks">目標URLクリック数</Label>
                  <Input
                    id="targetClicks"
                    type="number"
                    placeholder="例: 500"
                    value={formData.targetClicks}
                    onChange={(e) => setFormData({ ...formData, targetClicks: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetConversions">目標コンバージョン数</Label>
                  <Input
                    id="targetConversions"
                    type="number"
                    placeholder="例: 100"
                    value={formData.targetConversions}
                    onChange={(e) => setFormData({ ...formData, targetConversions: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="targetUrl">ターゲットURL（計測対象）</Label>
                  <Input
                    id="targetUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/projects")}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "作成中..." : "プロジェクトを作成"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
