import { useState, useEffect } from "react";
import { Zap, AlertTriangle, Check, X, Clock, Target, Loader2, PlayCircle, History, Settings2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AutoOptimizationSettingsProps {
  agentId: number;
}

const OPTIMIZATION_TYPE_LABELS: Record<string, string> = {
  tone_adjustment: "トーン調整",
  style_adjustment: "スタイル調整",
  content_strategy: "コンテンツ戦略",
  timing_optimization: "投稿時間最適化",
};

export default function AutoOptimizationSettings({ agentId }: AutoOptimizationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } =
    trpc.agents.getAutoOptimizationSettings.useQuery({ agentId });

  // Fetch pending optimizations
  const { data: pendingOptimizations, refetch: refetchPending } =
    trpc.agents.getPendingOptimizations.useQuery({ agentId });

  // Fetch optimization history
  const { data: optimizationHistory } =
    trpc.agents.getOptimizationHistory.useQuery({ agentId, limit: 5 });

  // Local state for form
  const [localSettings, setLocalSettings] = useState({
    enabled: false,
    minEngagementRateThreshold: 3.0,
    checkIntervalHours: 24,
    maxAutoOptimizationsPerWeek: 3,
    requireConfirmation: true,
    optimizationTypes: ['tone_adjustment', 'style_adjustment', 'content_strategy', 'timing_optimization'] as string[],
  });

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Mutations
  const updateSettingsMutation = trpc.agents.updateAutoOptimizationSettings.useMutation({
    onSuccess: () => {
      toast.success("自動最適化設定を更新しました");
      refetchSettings();
    },
    onError: () => {
      toast.error("設定の更新に失敗しました");
    },
  });

  const triggerOptimizationMutation = trpc.agents.triggerOptimization.useMutation({
    onSuccess: (result) => {
      if (result.needsOptimization) {
        toast.success(`最適化が必要です（現在: ${result.currentEngagement.toFixed(2)}%, 閾値: ${result.threshold}%）`);
        refetchPending();
      } else {
        toast.success(`パフォーマンスは良好です（${result.currentEngagement.toFixed(2)}%）`);
      }
    },
    onError: () => {
      toast.error("最適化チェックに失敗しました");
    },
  });

  const approveOptimizationMutation = trpc.agents.approveOptimization.useMutation({
    onSuccess: () => {
      toast.success("最適化を適用しました");
      refetchPending();
    },
    onError: () => {
      toast.error("最適化の適用に失敗しました");
    },
  });

  const rejectOptimizationMutation = trpc.agents.rejectOptimization.useMutation({
    onSuccess: () => {
      toast.success("最適化を却下しました");
      refetchPending();
    },
    onError: () => {
      toast.error("最適化の却下に失敗しました");
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      agentId,
      settings: localSettings,
    });
  };

  const handleToggleEnabled = (enabled: boolean) => {
    const newSettings = { ...localSettings, enabled };
    setLocalSettings(newSettings);
    updateSettingsMutation.mutate({
      agentId,
      settings: { enabled },
    });
  };

  const handleToggleOptimizationType = (type: string) => {
    const newTypes = localSettings.optimizationTypes.includes(type)
      ? localSettings.optimizationTypes.filter(t => t !== type)
      : [...localSettings.optimizationTypes, type];
    setLocalSettings({ ...localSettings, optimizationTypes: newTypes });
  };

  if (settingsLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              AI自動最適化
            </CardTitle>
            <CardDescription>
              パフォーマンスに応じてAIが戦略を自動調整します
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerOptimizationMutation.mutate({ agentId })}
              disabled={triggerOptimizationMutation.isPending}
            >
              {triggerOptimizationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              <span className="ml-2">今すぐチェック</span>
            </Button>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pending Optimizations */}
        {pendingOptimizations && pendingOptimizations.length > 0 && (
          <Alert className="border-yellow-300 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-yellow-800">
                  {pendingOptimizations.length}件の最適化提案があります
                </p>
                {pendingOptimizations.map((opt: any) => (
                  <div key={opt.id} className="p-3 bg-white rounded border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Badge variant="outline" className="mb-2">
                          {OPTIMIZATION_TYPE_LABELS[opt.type] || opt.type}
                        </Badge>
                        <p className="text-sm text-slate-700">{opt.insights}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          予想改善率: +{opt.performanceImprovement}%
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => approveOptimizationMutation.mutate({ optimizationId: opt.id })}
                          disabled={approveOptimizationMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => rejectOptimizationMutation.mutate({ optimizationId: opt.id })}
                          disabled={rejectOptimizationMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Form */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                詳細設定
              </span>
              <span className="text-xs text-slate-500">
                {isOpen ? "閉じる" : "開く"}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Engagement Rate Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  最低エンゲージメント率閾値
                </Label>
                <span className="text-sm font-medium">
                  {localSettings.minEngagementRateThreshold}%
                </span>
              </div>
              <Slider
                value={[localSettings.minEngagementRateThreshold]}
                onValueChange={([value]) =>
                  setLocalSettings({ ...localSettings, minEngagementRateThreshold: value })
                }
                min={0.5}
                max={10}
                step={0.5}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                この閾値を下回ると最適化が提案されます
              </p>
            </div>

            {/* Check Interval */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                チェック間隔（時間）
              </Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={localSettings.checkIntervalHours}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    checkIntervalHours: parseInt(e.target.value) || 24,
                  })
                }
              />
            </div>

            {/* Max Weekly Optimizations */}
            <div className="space-y-2">
              <Label>週間最大最適化回数</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={localSettings.maxAutoOptimizationsPerWeek}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    maxAutoOptimizationsPerWeek: parseInt(e.target.value) || 3,
                  })
                }
              />
            </div>

            {/* Require Confirmation */}
            <div className="flex items-center justify-between">
              <div>
                <Label>承認が必要</Label>
                <p className="text-xs text-slate-500">
                  オフにすると自動的に最適化が適用されます
                </p>
              </div>
              <Switch
                checked={localSettings.requireConfirmation}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, requireConfirmation: checked })
                }
              />
            </div>

            {/* Optimization Types */}
            <div className="space-y-3">
              <Label>最適化の種類</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(OPTIMIZATION_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`opt-${type}`}
                      checked={localSettings.optimizationTypes.includes(type)}
                      onCheckedChange={() => handleToggleOptimizationType(type)}
                    />
                    <label
                      htmlFor={`opt-${type}`}
                      className="text-sm cursor-pointer"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              className="w-full"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              設定を保存
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {/* Optimization History */}
        {optimizationHistory && optimizationHistory.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">最近の最適化履歴</span>
            </div>
            <div className="space-y-2">
              {optimizationHistory.slice(0, 5).map((opt: any) => (
                <div
                  key={opt.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={opt.status === 'applied' ? 'default' : opt.status === 'pending' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {opt.status === 'applied' ? '適用済み' : opt.status === 'pending' ? '保留中' : '却下'}
                    </Badge>
                    <span className="text-slate-600">
                      {OPTIMIZATION_TYPE_LABELS[opt.type] || opt.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(opt.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
