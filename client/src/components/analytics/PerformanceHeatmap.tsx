import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface HeatmapDataPoint {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hour: number; // 0-23
  engagementRate: number;
  postCount: number;
}

interface HeatmapProps {
  data: Array<HeatmapDataPoint>;
  isLoading?: boolean;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

function getCellColor(
  engagementRate: number | undefined,
  percentiles: { p25: number; p50: number; p75: number }
): string {
  if (engagementRate === undefined) return "#F1F5F9";
  if (engagementRate <= percentiles.p25) return "#DBEAFE";
  if (engagementRate <= percentiles.p50) return "#93C5FD";
  if (engagementRate <= percentiles.p75) return "#3B82F6";
  return "#1D4ED8";
}

function getTextColor(
  engagementRate: number | undefined,
  percentiles: { p25: number; p50: number; p75: number }
): string {
  if (engagementRate === undefined) return "#64748B";
  if (engagementRate <= percentiles.p50) return "#1A1D21";
  return "#EEF2FF";
}

function computePercentiles(values: number[]): {
  p25: number;
  p50: number;
  p75: number;
} {
  if (values.length === 0) return { p25: 0, p50: 0, p75: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };
  return {
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
  };
}

interface TooltipInfo {
  day: string;
  hour: number;
  engagementRate: number;
  postCount: number;
  x: number;
  y: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {DAY_LABELS.map((_, dayIndex) => (
        <div key={dayIndex} className="flex items-center gap-1">
          <div className="w-8 h-6 rounded bg-gray-200 animate-pulse" />
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="w-6 h-6 rounded-sm bg-gray-200 animate-pulse"
              style={{ animationDelay: `${(dayIndex * 24 + hour) * 15}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg
        className="w-12 h-12 mb-3"
        style={{ color: "#64748B" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
        />
      </svg>
      <p className="text-sm font-medium" style={{ color: "#1A1D21" }}>
        データがありません
      </p>
      <p className="text-xs mt-1" style={{ color: "#64748B" }}>
        投稿データが蓄積されると、時間帯ごとのパフォーマンスが表示されます
      </p>
    </div>
  );
}

export function PerformanceHeatmap({ data, isLoading }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const { dataMap, percentiles, topSlot } = useMemo(() => {
    const map = new Map<string, HeatmapDataPoint>();
    for (const d of data) {
      map.set(`${d.dayOfWeek}-${d.hour}`, d);
    }

    const rates = data.map((d) => d.engagementRate);
    const p = computePercentiles(rates);

    let best: HeatmapDataPoint | null = null;
    for (const d of data) {
      if (!best || d.engagementRate > best.engagementRate) {
        best = d;
      }
    }

    return { dataMap: map, percentiles: p, topSlot: best };
  }, [data]);

  const handleCellMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    dayIndex: number,
    hour: number
  ) => {
    const point = dataMap.get(`${dayIndex}-${hour}`);
    if (!point) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect =
      e.currentTarget.closest("[data-heatmap-container]")?.getBoundingClientRect();
    if (!parentRect) return;
    setTooltip({
      day: DAY_LABELS[dayIndex],
      hour,
      engagementRate: point.engagementRate,
      postCount: point.postCount,
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top,
    });
  };

  const handleCellMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ color: "#1A1D21" }}>
          投稿時間帯パフォーマンス
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <div
              className="relative overflow-x-auto"
              data-heatmap-container=""
            >
              {/* Tooltip */}
              {tooltip && (
                <div
                  className="absolute z-10 px-3 py-2 rounded-lg shadow-lg text-xs pointer-events-none whitespace-nowrap"
                  style={{
                    backgroundColor: "#1A1D21",
                    color: "#EEF2FF",
                    left: tooltip.x,
                    top: tooltip.y - 8,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div className="font-medium">
                    {tooltip.day}曜日 {tooltip.hour}:00
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div>
                      エンゲージメント率:{" "}
                      {tooltip.engagementRate.toFixed(2)}%
                    </div>
                    <div>投稿数: {tooltip.postCount}件</div>
                  </div>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
                    style={{
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderTop: "4px solid #1A1D21",
                    }}
                  />
                </div>
              )}

              {/* Grid */}
              <div className="inline-flex flex-col gap-1">
                {/* Hour labels row */}
                <div className="flex items-center gap-1">
                  <div className="w-8 shrink-0" />
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="w-6 h-4 flex items-center justify-center text-[10px] shrink-0"
                      style={{ color: "#64748B" }}
                    >
                      {(HOUR_LABELS as readonly number[]).includes(hour)
                        ? hour
                        : ""}
                    </div>
                  ))}
                </div>

                {/* Data rows */}
                {DAY_LABELS.map((dayLabel, dayIndex) => (
                  <div key={dayIndex} className="flex items-center gap-1">
                    <div
                      className="w-8 shrink-0 text-xs text-right pr-1 font-medium"
                      style={{ color: "#64748B" }}
                    >
                      {dayLabel}
                    </div>
                    {HOURS.map((hour) => {
                      const point = dataMap.get(`${dayIndex}-${hour}`);
                      const bgColor = getCellColor(
                        point?.engagementRate,
                        percentiles
                      );
                      const fgColor = getTextColor(
                        point?.engagementRate,
                        percentiles
                      );
                      return (
                        <div
                          key={hour}
                          className="w-6 h-6 rounded-sm cursor-pointer transition-transform duration-100 hover:scale-125 hover:z-10 relative shrink-0"
                          style={{ backgroundColor: bgColor, color: fgColor }}
                          onMouseEnter={(e) =>
                            handleCellMouseEnter(e, dayIndex, hour)
                          }
                          onMouseLeave={handleCellMouseLeave}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="text-[10px]"
                  style={{ color: "#64748B" }}
                >
                  低
                </span>
                {["#F1F5F9", "#DBEAFE", "#93C5FD", "#3B82F6", "#1D4ED8"].map(
                  (color) => (
                    <div
                      key={color}
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  )
                )}
                <span
                  className="text-[10px]"
                  style={{ color: "#64748B" }}
                >
                  高
                </span>
              </div>
            </div>

            {/* AI Recommendation */}
            {topSlot && (
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ backgroundColor: "#EEF2FF", color: "#5C5CFF" }}
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
                <span>
                  最もエンゲージメントが高い時間帯:{" "}
                  <span className="font-semibold">
                    {DAY_LABELS[topSlot.dayOfWeek]}曜日 {topSlot.hour}時
                  </span>
                  {" "}
                  (エンゲージメント率: {topSlot.engagementRate.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
