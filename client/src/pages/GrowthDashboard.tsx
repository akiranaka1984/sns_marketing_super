import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  TrendingUp,
  Heart,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Play,
  Square,
  Shield,
  CalendarDays,
  Flame,
  FileText,
  Zap,
  BarChart3,
  Users,
  DollarSign,
  Target,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

// ---- Helper: format relative time ----
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---- Health score color ----
function healthColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score > 70) return "text-emerald-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-500";
}

function healthBg(score: number | null): string {
  if (score === null) return "bg-muted-foreground/20";
  if (score > 70) return "bg-emerald-500/20";
  if (score >= 40) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

// ---- Content type color ----
function contentTypeColor(type: string): string {
  const map: Record<string, string> = {
    image: "bg-[#3db9cf]/20 text-[#3db9cf] border-[#3db9cf]/30",
    video: "bg-[#8b5cf6]/20 text-[#8b5cf6] border-[#8b5cf6]/30",
    carousel: "bg-[#e5a000]/20 text-[#e5a000] border-[#e5a000]/30",
    text: "bg-[#30a46c]/20 text-[#30a46c] border-[#30a46c]/30",
    story: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    reel: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };
  return map[type] || "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30";
}

// ---- Action status badge ----
function ActionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "executed":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border">
          <CheckCircle className="w-3 h-3 mr-1" />
          Executed
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 border">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
}

// ---- Sparkline mini chart ----
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Skeleton loader ----
function SkeletonCard() {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border animate-pulse">
      <div className="h-4 w-20 bg-muted rounded mb-3" />
      <div className="h-8 w-16 bg-muted rounded mb-2" />
      <div className="h-3 w-24 bg-muted/60 rounded" />
    </div>
  );
}

export default function GrowthDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  // --- Queries ---
  const { data: projectsList, isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const { data: kpiSummary, isLoading: kpiLoading } = trpc.growthDashboard.getKPISummary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 30000 }
  );

  const { data: loopStatus, isLoading: loopLoading } = trpc.growthDashboard.getGrowthLoopStatus.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 15000 }
  );

  const { data: accountHealth, isLoading: healthLoading } = trpc.growthDashboard.getAccountHealthOverview.useQuery(
    undefined,
    { enabled: !!selectedProjectId, refetchInterval: 60000 }
  );

  const { data: activeTrends, isLoading: trendsLoading } = trpc.growthDashboard.getActiveTrends.useQuery(
    undefined,
    { enabled: !!selectedProjectId, refetchInterval: 60000 }
  );

  const { data: calendarPreview, isLoading: calendarLoading } = trpc.growthDashboard.getCalendarPreview.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 60000 }
  );

  const { data: roiMetrics, isLoading: roiLoading } = trpc.growthDashboard.getROIMetrics.useQuery(
    { projectId: selectedProjectId! },
    { enabled: !!selectedProjectId, refetchInterval: 60000 }
  );

  const { data: report, isLoading: reportLoading } = trpc.growthDashboard.generateReport.useQuery(
    { projectId: selectedProjectId!, period: reportPeriod },
    { enabled: !!selectedProjectId }
  );

  // --- Mutations ---
  const utils = trpc.useUtils();
  const reviewMutation = trpc.growthDashboard.reviewAction.useMutation({
    onSuccess: () => {
      utils.growthDashboard.getGrowthLoopStatus.invalidate();
      toast.success("Action reviewed successfully");
    },
    onError: (error) => {
      toast.error("Failed: " + error.message);
    },
  });

  // --- Derived ---
  const kpiCards = [
    {
      title: "Total Posts (7d)",
      value: kpiSummary?.recentStats.totalPosts ?? 0,
      icon: Send,
      gradient: "from-[#3db9cf] to-[#3db9cf]/60",
      iconBg: "bg-[#3db9cf]/10",
      iconColor: "text-[#3db9cf]",
      sparkColor: "#3db9cf",
    },
    {
      title: "Avg Likes",
      value: kpiSummary?.recentStats.avgLikes ?? 0,
      icon: Heart,
      gradient: "from-[#e5484d] to-[#e5484d]/60",
      iconBg: "bg-[#e5484d]/10",
      iconColor: "text-[#e5484d]",
      sparkColor: "#e5484d",
    },
    {
      title: "Avg Comments",
      value: kpiSummary?.recentStats.avgComments ?? 0,
      icon: MessageCircle,
      gradient: "from-[#8b5cf6] to-[#8b5cf6]/60",
      iconBg: "bg-[#8b5cf6]/10",
      iconColor: "text-[#8b5cf6]",
      sparkColor: "#8b5cf6",
    },
    {
      title: "Pending Posts",
      value: kpiSummary?.pendingPostsCount ?? 0,
      icon: Clock,
      gradient: "from-[#e5a000] to-[#e5a000]/60",
      iconBg: "bg-[#e5a000]/10",
      iconColor: "text-[#e5a000]",
      sparkColor: "#e5a000",
    },
  ];

  // Group calendar entries by date
  const calendarByDate = (calendarPreview ?? []).reduce<Record<string, typeof calendarPreview>>((acc, entry) => {
    if (!entry.scheduledDate) return acc;
    const dateKey = new Date(entry.scheduledDate).toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey]!.push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* ---- Header + Project Selector ---- */}
      <div className="fade-in-up">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="gradient-text">Growth Dashboard</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Autonomous growth system overview and controls
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedProjectId?.toString() ?? ""}
              onValueChange={(v) => setSelectedProjectId(Number(v))}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projectsLoading ? (
                  <SelectItem value="__loading" disabled>
                    Loading...
                  </SelectItem>
                ) : projectsList && projectsList.length > 0 ? (
                  projectsList.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__empty" disabled>
                    No projects found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ---- Empty state if no project selected ---- */}
      {!selectedProjectId && (
        <div className="fade-in-up animation-delay-200">
          <div className="bg-card rounded-2xl p-12 shadow-sm border border-border text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#3db9cf]/20 to-[#8b5cf6]/20 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Select a Project</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Choose a project from the dropdown above to view its growth dashboard, KPIs, and autonomous actions.
            </p>
          </div>
        </div>
      )}

      {selectedProjectId && (
        <>
          {/* ---- KPI Cards Row ---- */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {kpiLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : kpiCards.map((card, index) => (
                  <div
                    key={card.title}
                    className="fade-in-up bg-card rounded-2xl p-5 shadow-sm border border-border hover:shadow-md transition-all duration-300 group relative overflow-hidden"
                    style={{ animationDelay: `${(index + 1) * 100}ms` }}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                        <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                      </div>
                      <Sparkline
                        data={[
                          Math.max(1, card.value * 0.6),
                          Math.max(1, card.value * 0.75),
                          Math.max(1, card.value * 0.65),
                          Math.max(1, card.value * 0.85),
                          Math.max(1, card.value * 0.9),
                          Math.max(1, card.value * 0.8),
                          Math.max(1, card.value),
                        ]}
                        color={card.sparkColor}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                      <p className="text-3xl font-bold tracking-tight text-foreground">
                        {card.value.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
          </div>

          {/* ---- Growth Loop Status + Recent Actions ---- */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Growth Loop Status */}
            <div className="fade-in-up animation-delay-300 lg:col-span-1">
              <div className="bg-card rounded-2xl p-6 h-full shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[#3db9cf]/10 to-[#8b5cf6]/10">
                    <Zap className="w-5 h-5 text-[#8b5cf6]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">Growth Loop</h3>
                    <p className="text-sm text-muted-foreground">Autonomous system status</p>
                  </div>
                </div>

                {loopLoading ? (
                  <div className="space-y-4 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-6 bg-muted rounded" />
                    ))}
                  </div>
                ) : loopStatus ? (
                  <div className="space-y-5">
                    {/* Running indicator */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {loopStatus.isRunning ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border gap-1.5">
                          <Play className="w-3 h-3" />
                          Running
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border gap-1.5">
                          <Square className="w-3 h-3" />
                          Stopped
                        </Badge>
                      )}
                    </div>

                    {/* Last KPI check */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last KPI Check</span>
                      <span className="text-sm font-medium text-foreground/80">
                        {timeAgo(loopStatus.lastKpiCheck)}
                      </span>
                    </div>

                    {/* Strategy score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Strategy Score</span>
                        <span className="text-sm font-bold text-foreground">
                          {loopStatus.currentStrategyScore}/100
                        </span>
                      </div>
                      <Progress
                        value={loopStatus.currentStrategyScore}
                        className="h-2"
                      />
                    </div>

                    {/* Consecutive declines */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Consecutive Declines</span>
                      <span className={`text-sm font-medium ${
                        loopStatus.consecutiveDeclines > 2
                          ? "text-red-500"
                          : loopStatus.consecutiveDeclines > 0
                            ? "text-yellow-500"
                            : "text-foreground/80"
                      }`}>
                        {loopStatus.consecutiveDeclines}
                      </span>
                    </div>

                    {/* Escalation warning */}
                    {loopStatus.escalationNeeded && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-400">Escalation Needed</p>
                          {loopStatus.escalationReason && (
                            <p className="text-xs text-red-400/80 mt-0.5">
                              {loopStatus.escalationReason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pending actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-sm text-muted-foreground">Pending Actions</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {loopStatus.pendingActionsCount}
                        </span>
                        {loopStatus.pendingActionsCount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              const actionsSection = document.getElementById("actions-section");
                              actionsSection?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Zap className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No loop state found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Autonomous Actions */}
            <div id="actions-section" className="fade-in-up animation-delay-400 lg:col-span-2">
              <div className="bg-card rounded-2xl p-6 h-full shadow-sm border border-border">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#3db9cf]/10">
                      <Activity className="w-5 h-5 text-[#3db9cf]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">Recent Actions</h3>
                      <p className="text-sm text-muted-foreground">Autonomous growth loop actions</p>
                    </div>
                  </div>
                </div>

                {loopLoading ? (
                  <div className="space-y-3 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-14 bg-muted rounded-xl" />
                    ))}
                  </div>
                ) : loopStatus && loopStatus.recentActions.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto">
                    {loopStatus.recentActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-accent transition-colors border border-transparent hover:border-border"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="outline" className="shrink-0 capitalize text-xs">
                            {action.actionType.replace(/_/g, " ")}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {action.description || "No description"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {timeAgo(action.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <ActionStatusBadge status={action.status} />
                          {action.status === "pending" && (
                            <div className="flex gap-1 ml-2">
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({ actionId: action.id, approved: true })
                                }
                              >
                                <CheckCircle className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({ actionId: action.id, approved: false })
                                }
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No actions recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- Account Health Overview ---- */}
          <div className="fade-in-up animation-delay-500">
            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#30a46c]/10">
                  <Shield className="w-5 h-5 text-[#30a46c]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Account Health</h3>
                  <p className="text-sm text-muted-foreground">Health scores and operational status</p>
                </div>
              </div>

              {healthLoading ? (
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : accountHealth && accountHealth.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Posts Today</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountHealth.map((account) => (
                      <TableRow
                        key={account.accountId}
                        className={
                          account.isThrottled || account.isSuspended
                            ? "bg-red-500/5"
                            : ""
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3db9cf]/20 to-[#8b5cf6]/20 flex items-center justify-center">
                              <span className="text-xs font-bold gradient-text">
                                {account.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-foreground">
                              {account.username}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {account.platform}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground capitalize">
                            {account.accountPhase}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${healthBg(account.healthScore)} ${healthColor(account.healthScore)}`}>
                              {account.healthScore ?? "--"}
                            </div>
                            <div className="w-16">
                              <Progress
                                value={account.healthScore ?? 0}
                                className="h-1.5"
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground/80">
                            {account.postsToday}/{account.maxDailyPosts}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {account.isThrottled && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">
                                Throttled
                              </Badge>
                            )}
                            {account.isSuspended && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs">
                                Suspended
                              </Badge>
                            )}
                            {!account.isThrottled && !account.isSuspended && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 border text-xs">
                                OK
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No accounts found</p>
                </div>
              )}
            </div>
          </div>

          {/* ---- Content Calendar + Active Trends ---- */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Content Calendar Preview */}
            <div className="fade-in-up animation-delay-600">
              <div className="bg-card rounded-2xl p-6 h-full shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-[#e5a000]/10">
                    <CalendarDays className="w-5 h-5 text-[#e5a000]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">Content Calendar</h3>
                    <p className="text-sm text-muted-foreground">Next 7 days</p>
                  </div>
                </div>

                {calendarLoading ? (
                  <div className="animate-pulse space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i}>
                        <div className="h-4 w-20 bg-muted rounded mb-2" />
                        <div className="h-8 bg-muted/60 rounded" />
                      </div>
                    ))}
                  </div>
                ) : calendarPreview && calendarPreview.length > 0 ? (
                  <div className="space-y-4 max-h-[380px] overflow-y-auto">
                    {Object.entries(calendarByDate).map(([dateKey, entries]) => (
                      <div key={dateKey}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          {dateKey}
                        </p>
                        <div className="space-y-2">
                          {entries!.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted hover:bg-accent transition-colors"
                            >
                              <Badge
                                className={`text-xs border ${contentTypeColor(entry.contentType ?? "text")} capitalize`}
                              >
                                {entry.contentType || "text"}
                              </Badge>
                              <span className="text-sm text-foreground/80 truncate flex-1">
                                {entry.topic || "Untitled"}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {entry.timeSlot || "--:--"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarDays className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No scheduled content</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Trends */}
            <div className="fade-in-up animation-delay-700">
              <div className="bg-card rounded-2xl p-6 h-full shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Flame className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">Active Trends</h3>
                    <p className="text-sm text-muted-foreground">Latest detected trends (24h)</p>
                  </div>
                </div>

                {trendsLoading ? (
                  <div className="animate-pulse space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded-xl" />
                    ))}
                  </div>
                ) : activeTrends && activeTrends.length > 0 ? (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto">
                    {activeTrends.map((trend) => (
                      <div
                        key={trend.id}
                        className="p-3 rounded-xl bg-muted hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#3db9cf]" />
                            <span className="text-sm font-medium text-foreground">
                              {trend.trendName}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              trend.status === "responding" || trend.status === "responded"
                                ? "text-emerald-400 border-emerald-500/30"
                                : trend.status === "expired" || trend.status === "ignored"
                                  ? "text-muted-foreground border-border"
                                  : "text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {trend.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Relevance</span>
                              <span className="font-medium">
                                {trend.relevanceScore ?? 0}%
                              </span>
                            </div>
                            <Progress
                              value={trend.relevanceScore ?? 0}
                              className="h-1.5"
                            />
                          </div>
                          <Badge variant="outline" className="text-xs capitalize shrink-0">
                            {trend.platform}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Flame className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No active trends detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- ROI Metrics + Performance Report ---- */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ROI Metrics */}
            <div className="fade-in-up animation-delay-800 lg:col-span-2">
              <div className="bg-card rounded-2xl p-6 h-full shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">ROI Metrics</h3>
                    <p className="text-sm text-muted-foreground">Campaign performance and returns</p>
                  </div>
                </div>

                {roiLoading ? (
                  <div className="animate-pulse space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded" />
                    ))}
                  </div>
                ) : roiMetrics && roiMetrics.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Goal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roiMetrics.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <span className="font-medium text-foreground">
                              {campaign.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {campaign.goal || "--"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs border capitalize ${
                                campaign.status === "active"
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : campaign.status === "completed"
                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                    : "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30"
                              }`}
                            >
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-foreground/80">
                            {campaign.budget > 0 ? `¥${campaign.budget.toLocaleString()}` : "--"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-foreground/80">
                            {campaign.revenue > 0 ? `¥${campaign.revenue.toLocaleString()}` : "--"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-sm font-bold ${
                                campaign.roi > 0
                                  ? "text-emerald-400"
                                  : campaign.roi < 0
                                    ? "text-red-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {campaign.roi > 0 ? "+" : ""}
                              {campaign.roi}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No campaigns found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Report */}
            <div className="fade-in-up animation-delay-900 lg:col-span-1">
              <div className="bg-card rounded-2xl p-6 h-full shadow-sm border border-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-[#8b5cf6]/10">
                    <FileText className="w-5 h-5 text-[#8b5cf6]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">Performance Report</h3>
                    <p className="text-sm text-muted-foreground">Period summary</p>
                  </div>
                </div>

                {/* Period selector */}
                <div className="flex gap-1 mb-5 bg-muted rounded-lg p-1">
                  {(["daily", "weekly", "monthly"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setReportPeriod(p)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
                        reportPeriod === p
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p === "daily" ? "Daily" : p === "weekly" ? "Weekly" : "Monthly"}
                    </button>
                  ))}
                </div>

                {reportLoading ? (
                  <div className="animate-pulse space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded-xl" />
                    ))}
                  </div>
                ) : report ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Total Posts</span>
                        <Send className="w-3.5 h-3.5 text-[#3db9cf]" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {report.metrics.totalPosts.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Avg Likes</span>
                        <Heart className="w-3.5 h-3.5 text-[#e5484d]" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {report.metrics.avgLikes.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Total Engagement</span>
                        <Target className="w-3.5 h-3.5 text-[#8b5cf6]" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {report.metrics.totalEngagement.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Automation Actions</span>
                        <Zap className="w-3.5 h-3.5 text-[#e5a000]" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {report.automationActions.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      {new Date(report.startDate).toLocaleDateString("ja-JP")} ~ {new Date(report.endDate).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
