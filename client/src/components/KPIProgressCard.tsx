import { TrendingUp, Users, MousePointer, Percent, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface KPIProgressCardProps {
  targets: {
    followers?: number;
    engagement?: number;
    clicks?: number;
    conversions?: number;
  } | null;
  currentMetrics?: {
    followers?: number;
    engagement?: number;
    clicks?: number;
    conversions?: number;
  };
}

interface KPIItem {
  label: string;
  icon: typeof TrendingUp;
  target: number;
  current: number;
  unit: string;
  color: string;
}

export default function KPIProgressCard({ targets, currentMetrics = {} }: KPIProgressCardProps) {
  if (!targets) {
    return null;
  }

  const kpis: KPIItem[] = [];

  if (targets.followers) {
    kpis.push({
      label: "フォロワー",
      icon: Users,
      target: targets.followers,
      current: currentMetrics.followers || 0,
      unit: "",
      color: "bg-blue-500",
    });
  }

  if (targets.engagement) {
    kpis.push({
      label: "エンゲージメント率",
      icon: Percent,
      target: targets.engagement,
      current: currentMetrics.engagement || 0,
      unit: "%",
      color: "bg-green-500",
    });
  }

  if (targets.clicks) {
    kpis.push({
      label: "クリック数",
      icon: MousePointer,
      target: targets.clicks,
      current: currentMetrics.clicks || 0,
      unit: "",
      color: "bg-purple-500",
    });
  }

  if (targets.conversions) {
    kpis.push({
      label: "コンバージョン",
      icon: Target,
      target: targets.conversions,
      current: currentMetrics.conversions || 0,
      unit: "",
      color: "bg-orange-500",
    });
  }

  if (kpis.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          KPI進捗
        </CardTitle>
        <CardDescription>設定した目標に対する進捗状況</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kpis.map((kpi) => {
          const progress = Math.min((kpi.current / kpi.target) * 100, 100);
          const Icon = kpi.icon;

          return (
            <div key={kpi.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <Icon className="h-4 w-4" />
                  {kpi.label}
                </span>
                <span className="text-slate-900 font-medium">
                  {kpi.current.toLocaleString()}{kpi.unit} / {kpi.target.toLocaleString()}{kpi.unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-2 flex-1" />
                <span className="text-xs text-slate-500 w-8 text-right">
                  {progress.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div className="pt-4 border-t mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">総合達成率</span>
            <span className="text-lg font-bold text-slate-900">
              {(kpis.reduce((acc, kpi) => acc + Math.min((kpi.current / kpi.target) * 100, 100), 0) / kpis.length).toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
