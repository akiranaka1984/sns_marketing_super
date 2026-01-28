import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Users,
  Smartphone,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Calendar,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

// Animated counter component
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  return (
    <span className="counter tabular-nums">{value}</span>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; icon: typeof CheckCircle2 }> = {
    success: { class: "status-active", icon: CheckCircle2 },
    active: { class: "status-active", icon: CheckCircle2 },
    pending: { class: "status-pending", icon: Clock },
    failed: { class: "status-failed", icon: XCircle },
    suspended: { class: "status-suspended", icon: AlertCircle },
  };

  const { class: className, icon: Icon } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: availableDevices } = trpc.devices.availableCount.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: recentLogs } = trpc.logs.recent.useQuery(
    { limit: 10 },
    {
      refetchInterval: 60000,
    }
  );

  const activeAccounts = accounts?.filter(a => a.status === 'active').length || 0;
  const pendingAccounts = accounts?.filter(a => a.status === 'pending').length || 0;
  const failedAccounts = accounts?.filter(a => a.status === 'failed').length || 0;
  const totalAccounts = accounts?.length || 0;

  const stats = [
    {
      title: t('dashboard.totalAccounts'),
      value: totalAccounts,
      subtitle: `${activeAccounts} ${t('dashboard.active')}, ${pendingAccounts} ${t('dashboard.pending')}`,
      icon: Users,
      gradient: "from-[#3db9cf] to-[#3db9cf]/60",
      iconBg: "icon-gradient-cyan",
      trend: { value: 12, up: true },
    },
    {
      title: t('dashboard.activeAccounts'),
      value: activeAccounts,
      subtitle: t('dashboard.successfullyRegistered'),
      icon: Activity,
      gradient: "from-[#30a46c] to-[#30a46c]/60",
      iconBg: "icon-gradient-emerald",
      trend: { value: 8, up: true },
    },
    {
      title: t('dashboard.availableDevices'),
      value: availableDevices || 0,
      subtitle: t('dashboard.readyForRegistration'),
      icon: Smartphone,
      gradient: "from-[#8b5cf6] to-[#8b5cf6]/60",
      iconBg: "icon-gradient-purple",
      trend: { value: 3, up: false },
    },
    {
      title: t('dashboard.failedAccounts'),
      value: failedAccounts,
      subtitle: t('dashboard.needsAttention'),
      icon: TrendingUp,
      gradient: "from-[#e5a000] to-[#e5a000]/60",
      iconBg: "icon-gradient-amber",
      trend: { value: 2, up: false },
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="fade-in-up">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="gradient-text">{t('dashboard.title')}</span>
              <span className="text-gray-900">, {user?.name || 'User'}</span>
            </h1>
            <p className="text-gray-500 text-lg">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white shadow-sm border border-gray-100">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('ja-JP', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.title}
            className="fade-in-up bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group relative overflow-hidden"
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            {/* Top gradient line */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />

            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                <stat.icon className="w-5 h-5 text-gray-700" />
              </div>
              {stat.trend && (
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  stat.trend.up ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {stat.trend.up ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {stat.trend.value}%
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-3xl font-bold tracking-tight text-gray-900">
                {accountsLoading ? (
                  <span className="inline-block w-16 h-8 bg-gray-100 rounded animate-pulse" />
                ) : (
                  <AnimatedNumber value={stat.value} />
                )}
              </p>
              <p className="text-xs text-gray-400">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="fade-in-up animation-delay-500 lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 h-full shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-[#3db9cf]/10">
                <Zap className="w-5 h-5 text-[#3db9cf]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{t('dashboard.quickActions')}</h3>
                <p className="text-sm text-gray-500">{t('dashboard.quickActionsSubtitle')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                className="w-full justify-between bg-gradient-to-r from-[#3db9cf] to-[#8b5cf6] hover:from-[#4bc5db] hover:to-[#9d6ff8] text-white border-0 shadow-md shadow-[#3db9cf]/20 transition-all duration-300 hover:shadow-lg hover:shadow-[#3db9cf]/30 h-12"
                asChild
              >
                <Link href="/accounts/new">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('dashboard.addNewAccount')}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 transition-all duration-300 h-12"
                asChild
              >
                <Link href="/strategies/new">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
                    {t('dashboard.generateStrategy')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 transition-all duration-300 h-12"
                asChild
              >
                <Link href="/scheduled-posts">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#30a46c]" />
                    スケジュール投稿
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="fade-in-up animation-delay-600 lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 h-full shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#8b5cf6]/10">
                  <Activity className="w-5 h-5 text-[#8b5cf6]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{t('dashboard.recentActivity')}</h3>
                  <p className="text-sm text-gray-500">{t('dashboard.recentActivitySubtitle')}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900" asChild>
                <Link href="/logs">
                  {t('dashboard.viewAllLogs')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="space-y-3">
              {recentLogs && recentLogs.length > 0 ? (
                recentLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        log.status === 'success' ? 'bg-emerald-500' :
                        log.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString('ja-JP')}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={log.status} />
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">{t('dashboard.noRecentActivity')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts Overview */}
      <div className="fade-in-up animation-delay-700">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#30a46c]/10">
                <Users className="w-5 h-5 text-[#30a46c]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{t('dashboard.yourAccounts')}</h3>
                <p className="text-sm text-gray-500">{t('dashboard.yourAccountsSubtitle')}</p>
              </div>
            </div>
            {accounts && accounts.length > 0 && (
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900" asChild>
                <Link href="/accounts">
                  View All Accounts
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>

          {accountsLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl bg-gray-50 animate-pulse">
                  <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-20 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {accounts.slice(0, 6).map((account) => (
                <Link
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="group p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3db9cf]/20 to-[#8b5cf6]/20 flex items-center justify-center">
                        <span className="text-lg font-bold gradient-text">
                          {account.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-[#3db9cf] transition-colors">
                          {account.username}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{account.platform}</p>
                      </div>
                    </div>
                    <StatusBadge status={account.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#3db9cf]/20 to-[#8b5cf6]/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="font-semibold mb-2 text-gray-900">No accounts yet</h4>
              <p className="text-sm text-gray-500 mb-6">
                Get started by adding your first social media account
              </p>
              <Button
                className="bg-gradient-to-r from-[#3db9cf] to-[#8b5cf6] hover:from-[#4bc5db] hover:to-[#9d6ff8] text-white border-0"
                asChild
              >
                <Link href="/accounts/new">
                  <Users className="w-4 h-4 mr-2" />
                  Add Your First Account
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
