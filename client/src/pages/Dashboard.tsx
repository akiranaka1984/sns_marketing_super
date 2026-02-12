import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  MoreHorizontal,
  Plus,
  Filter,
  ArrowUpDown,
  Users,
  ScrollText,
  Zap,
  Lightbulb,
  BarChart3,
  Smartphone,
  ArrowRight,
  Activity,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Link } from "wouter";

function StatusTag({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
    success: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
    pending: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
    failed: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500" },
  };
  const { bg, text, dot } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${bg} ${text}`}>
      <span className={`w-1 h-1 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: recentLogs } = trpc.logs.recent.useQuery(
    { limit: 10 },
    { refetchInterval: 60000 }
  );

  const activeAccounts = accounts?.filter(a => a.status === 'active').length || 0;
  const pendingAccounts = accounts?.filter(a => a.status === 'pending').length || 0;
  const totalAccounts = accounts?.length || 0;

  return (
    <div className="min-h-full max-w-[1100px]">
      {/* Page Header */}
      <div className="mb-7">
        <h1 className="text-[20px] font-semibold text-foreground tracking-[-0.03em]">ホーム</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
          })}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        {[
          { label: "アカウント総数", value: totalAccounts, icon: Users, color: "text-indigo-500" },
          { label: "アクティブ", value: activeAccounts, icon: Activity, color: "text-emerald-500" },
          { label: "保留中", value: pendingAccounts, icon: Clock, color: "text-amber-500" },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border border-border rounded-lg px-4 py-3.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <StatIcon className={`w-3.5 h-3.5 ${stat.color}`} strokeWidth={1.5} />
              </div>
              <p className="text-[22px] font-semibold text-foreground tabular-nums tracking-tight">{stat.value}</p>
            </div>
          );
        })}
        <div className="bg-card border border-dashed border-border rounded-lg px-4 py-3.5 flex items-center justify-center hover:border-primary/30 hover:bg-primary/[0.02] transition-all">
          <Link href="/accounts/new" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary font-medium transition-colors">
            <Plus className="w-4 h-4" />
            アカウント追加
          </Link>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2 tracking-[-0.01em]">
            アカウント
          </h2>
          <div className="flex items-center gap-0.5">
            <button className="flex items-center gap-1 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <Filter className="w-3 h-3" />
              フィルター
            </button>
            <button className="flex items-center gap-1 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <ArrowUpDown className="w-3 h-3" />
              ソート
            </button>
            <Link href="/accounts" className="flex items-center gap-1 px-2 py-1 text-[12px] text-primary hover:bg-primary/5 rounded-md transition-colors font-medium">
              すべて表示
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[1fr_120px_100px_120px] border-b border-border">
            <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">名前</div>
            <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">プラットフォーム</div>
            <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">ステータス</div>
            <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">作成日</div>
          </div>

          {accountsLoading ? (
            <div className="p-8 text-center text-[13px] text-muted-foreground">読み込み中...</div>
          ) : accounts && accounts.length > 0 ? (
            accounts.slice(0, 5).map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="grid grid-cols-[1fr_120px_100px_120px] border-b border-border/50 last:border-b-0 hover:bg-accent/40 transition-colors group"
              >
                <div className="px-4 py-2.5 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">{account.username}</span>
                </div>
                <div className="px-4 py-2.5 text-[13px] text-muted-foreground flex items-center">
                  {account.platform === 'twitter' ? 'X (Twitter)' : account.platform}
                </div>
                <div className="px-4 py-2.5 flex items-center">
                  <StatusTag status={account.status} />
                </div>
                <div className="px-4 py-2.5 text-[12px] text-muted-foreground tabular-nums flex items-center font-mono">
                  {new Date(account.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </Link>
            ))
          ) : (
            <div className="p-10 text-center">
              <p className="text-[13px] text-muted-foreground mb-3">アカウントがありません</p>
              <Link
                href="/accounts/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[13px] font-medium rounded-md transition-colors hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                新規作成
              </Link>
            </div>
          )}

          {accounts && accounts.length > 0 && (
            <Link
              href="/accounts/new"
              className="flex items-center gap-2 px-4 py-2 text-[12px] text-muted-foreground hover:text-primary hover:bg-accent/40 transition-colors border-t border-border/50"
            >
              <Plus className="w-3 h-3" />
              新規追加
            </Link>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2 tracking-[-0.01em]">
            最近のアクティビティ
          </h2>
          <Link href="/logs" className="flex items-center gap-1 px-2 py-1 text-[12px] text-primary hover:bg-primary/5 rounded-md transition-colors font-medium">
            すべて表示
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
          {recentLogs && recentLogs.length > 0 ? (
            recentLogs.slice(0, 5).map((log, index) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors group ${index !== 0 ? 'border-t border-border/50' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  log.status === 'success' ? 'bg-emerald-500' :
                  log.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                }`} />
                <span className="flex-1 text-[13px] text-foreground truncate">{log.action}</span>
                <StatusTag status={log.status} />
                <span className="text-[11px] text-muted-foreground flex-shrink-0 tabular-nums font-mono">
                  {new Date(log.createdAt).toLocaleString('ja-JP', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded-md transition-all">
                  <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-[13px] text-muted-foreground">
              アクティビティがありません
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-2.5 tracking-[-0.01em]">
          クイックアクション
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: "/automation", icon: Zap, label: "自動化設定", sub: "ワークフロー管理", color: "text-amber-500", bg: "bg-amber-50" },
            { href: "/strategies/new", icon: Lightbulb, label: "戦略を生成", sub: "AI戦略アシスト", color: "text-violet-500", bg: "bg-violet-50" },
            { href: "/analytics", icon: BarChart3, label: "分析を見る", sub: "パフォーマンス分析", color: "text-indigo-500", bg: "bg-indigo-50" },
          ].map((action) => {
            const ActionIcon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-accent/40 hover:shadow-[var(--shadow-card-hover)] transition-all group shadow-[var(--shadow-card)]"
              >
                <div className={`w-8 h-8 rounded-md ${action.bg} flex items-center justify-center flex-shrink-0`}>
                  <ActionIcon className={`w-4 h-4 ${action.color}`} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-medium text-foreground block tracking-[-0.01em]">{action.label}</span>
                  <span className="text-[11px] text-muted-foreground">{action.sub}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
