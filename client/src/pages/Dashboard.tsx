import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, Users, Smartphone, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery(undefined, {
    refetchInterval: 60000, // Refetch every 60 seconds
  });
  const { data: availableDevices } = trpc.devices.availableCount.useQuery(undefined, {
    refetchInterval: 60000, // Refetch every 60 seconds
  });
  const { data: recentLogs } = trpc.logs.recent.useQuery(
    { limit: 10 },
    {
      refetchInterval: 60000, // Refetch every 60 seconds
    }
  );

  const activeAccounts = accounts?.filter(a => a.status === 'active').length || 0;
  const pendingAccounts = accounts?.filter(a => a.status === 'pending').length || 0;
  const failedAccounts = accounts?.filter(a => a.status === 'failed').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            {t('dashboard.title')}, {user?.name || 'User'}
          </h1>
          <p className="text-slate-600">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {t('dashboard.totalAccounts')}
              </CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {accountsLoading ? '...' : accounts?.length || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {activeAccounts} {t('dashboard.active')}, {pendingAccounts} {t('dashboard.pending')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {t('dashboard.activeAccounts')}
              </CardTitle>
              <Activity className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {activeAccounts}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('dashboard.successfullyRegistered')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {t('dashboard.availableDevices')}
              </CardTitle>
              <Smartphone className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {availableDevices || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('dashboard.readyForRegistration')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {t('dashboard.failedAccounts')}
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {failedAccounts}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t('dashboard.needsAttention')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
              <CardDescription>
                {t('dashboard.quickActionsSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" size="lg" asChild>
                <Link href="/accounts/new">
                  {t('dashboard.addNewAccount')}
                </Link>
              </Button>
              <Button className="w-full" variant="outline" size="lg" asChild>
                <Link href="/strategies/new">
                  {t('dashboard.generateStrategy')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
              <CardDescription>
                {t('dashboard.recentActivitySubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLogs && recentLogs.length > 0 ? (
                  recentLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2">
                      <div>
                        <p className="font-medium text-slate-900">{log.action}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : log.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t('dashboard.noRecentActivity')}</p>
                )}
              </div>
              <Button variant="link" className="w-full mt-4" asChild>
                <Link href="/logs">
                  {t('dashboard.viewAllLogs')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Overview */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.yourAccounts')}</CardTitle>
            <CardDescription>
              {t('dashboard.yourAccountsSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <p className="text-sm text-slate-500">Loading accounts...</p>
            ) : accounts && accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.slice(0, 5).map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">{account.username}</p>
                      <p className="text-sm text-slate-500 capitalize">{account.platform}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        account.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : account.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : account.status === 'suspended'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {account.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-4">No accounts yet</p>
                <Button asChild>
                  <Link href="/accounts/new">Add Your First Account</Link>
                </Button>
              </div>
            )}
            {accounts && accounts.length > 5 && (
              <Button variant="link" className="w-full mt-4" asChild>
                <Link href="/accounts">
                  View All Accounts
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
