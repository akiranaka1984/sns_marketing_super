import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { Eye, Heart, MessageCircle, Share2, TrendingUp } from "lucide-react";

type TimeSeriesPoint = {
  date: string;
  posts?: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
};

type MetricKey = "engagementRate" | "posts" | "views" | "likes" | "comments" | "shares";

const METRICS: { key: MetricKey; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "engagementRate", label: "エンゲージメント率", color: "#5C5CFF", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "posts", label: "投稿数", color: "#06B6D4", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "views", label: "視聴回数", color: "#2563EB", icon: <Eye className="w-3.5 h-3.5" /> },
  { key: "likes", label: "いいね", color: "#10B981", icon: <Heart className="w-3.5 h-3.5" /> },
  { key: "comments", label: "コメント", color: "#F59E0B", icon: <MessageCircle className="w-3.5 h-3.5" /> },
  { key: "shares", label: "シェア", color: "#EF4444", icon: <Share2 className="w-3.5 h-3.5" /> },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatValue(value: number, key: MetricKey): string {
  if (key === "engagementRate") return `${value.toFixed(2)}%`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function TrendChart({
  data,
  isLoading,
}: {
  data: TimeSeriesPoint[];
  isLoading: boolean;
}) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(["engagementRate", "likes"])
  );

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1A1D24] rounded-xl border border-[#E2E8F0] dark:border-[#2D3748] p-4 shadow-sm">
        <div className="h-4 w-32 bg-[#F1F5F9] dark:bg-[#1F2937] rounded shimmer mb-2" />
        <div className="h-3 w-48 bg-[#F1F5F9] dark:bg-[#1F2937] rounded shimmer mb-4" />
        <div className="h-[300px] bg-[#F8FAFC] dark:bg-[#111318] rounded-lg shimmer" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A1D24] rounded-xl border border-[#E2E8F0] dark:border-[#2D3748] p-4 shadow-sm">
        <h3 className="font-semibold text-sm text-[#1E293B] dark:text-[#E5E7EB] mb-1">パフォーマンストレンド</h3>
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
          <p className="text-[#94A3B8] text-sm">まだデータがありません</p>
          <p className="text-xs text-[#94A3B8] mt-2">投稿を開始すると、ここにトレンドデータが表示されます</p>
        </div>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    dateLabel: formatDate(point.date),
  }));

  // Determine if we need dual Y axes
  const hasEngagementRate = activeMetrics.has("engagementRate");
  const hasCountMetrics = [...activeMetrics].some((m) => m !== "engagementRate");

  return (
    <div className="bg-white dark:bg-[#1A1D24] rounded-xl border border-[#E2E8F0] dark:border-[#2D3748] p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-sm text-[#1E293B] dark:text-[#E5E7EB]">パフォーマンストレンド</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">{data.length}日間のパフォーマンス推移</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((metric) => (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
                ${activeMetrics.has(metric.key)
                  ? "text-white shadow-sm"
                  : "text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#1F2937] hover:bg-[#E2E8F0] dark:hover:bg-[#2D3748]"
                }
              `}
              style={activeMetrics.has(metric.key) ? { backgroundColor: metric.color } : undefined}
            >
              {metric.icon}
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              {METRICS.filter((m) => activeMetrics.has(m.key)).map((metric) => (
                <linearGradient key={metric.key} id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                if (hasEngagementRate && !hasCountMetrics) return `${v}%`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                return v;
              }}
            />
            {hasEngagementRate && hasCountMetrics && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                const metric = METRICS.find((m) => m.key === name);
                return [formatValue(value, name as MetricKey), metric?.label || name];
              }}
              labelFormatter={(label) => `日付: ${label}`}
            />
            {METRICS.filter((m) => activeMetrics.has(m.key)).map((metric) => (
              <Area
                key={metric.key}
                yAxisId={metric.key === "engagementRate" && hasCountMetrics ? "right" : "left"}
                type="monotone"
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={2}
                fill={`url(#gradient-${metric.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
