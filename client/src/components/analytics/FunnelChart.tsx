import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelChartProps {
  stages: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  isLoading?: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  impression: "インプレッション",
  engagement: "エンゲージメント",
  profile_visit: "プロフ閲覧",
  follow: "フォロー",
  conversion: "コンバージョン",
};

const STAGE_COLORS: Record<string, string> = {
  impression: "#93C5FD",
  engagement: "#60A5FA",
  profile_visit: "#3B82F6",
  follow: "#2563EB",
  conversion: "#1D4ED8",
};

function SkeletonBar({ width }: { width: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center gap-4">
        <div
          className="h-10 animate-pulse rounded bg-gray-200"
          style={{ width }}
        />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

export function FunnelChart({ stages, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>コンバージョンファネル</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3">
            <SkeletonBar width="100%" />
            <SkeletonBar width="80%" />
            <SkeletonBar width="60%" />
            <SkeletonBar width="40%" />
            <SkeletonBar width="25%" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>コンバージョンファネル</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            データがありません
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCount = stages[0]?.count ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>コンバージョンファネル</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-0">
          {stages.map((stage, index) => {
            const barWidthPercent =
              maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
            const label = STAGE_LABELS[stage.stage] ?? stage.stage;
            const color = STAGE_COLORS[stage.stage] ?? "#6B7280";

            const prevCount = index > 0 ? stages[index - 1].count : null;
            const conversionRate =
              prevCount !== null && prevCount > 0
                ? ((stage.count / prevCount) * 100).toFixed(1)
                : null;

            return (
              <div key={stage.stage} className="w-full">
                {index > 0 && conversionRate !== null && (
                  <div className="flex flex-col items-center py-1">
                    <svg
                      className="text-gray-400"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M8 2L8 14M8 14L3 9M8 14L13 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-xs text-muted-foreground">
                      {conversionRate}%
                    </span>
                  </div>
                )}

                <div className="flex w-full items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-center">
                      <div
                        className="flex h-10 items-center justify-center rounded transition-all duration-300"
                        style={{
                          width: `${Math.max(barWidthPercent, 8)}%`,
                          backgroundColor: color,
                        }}
                      >
                        <span className="truncate px-2 text-xs font-medium text-white">
                          {label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-28 shrink-0 text-right">
                    <span className="text-sm font-semibold">
                      {stage.count.toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({stage.percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
