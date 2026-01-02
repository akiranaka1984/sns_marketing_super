import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function Logs() {
  const { t } = useI18n();
  const { data: logs, isLoading } = trpc.logs.recent.useQuery({ limit: 100 });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{t('logs.title')}</h1>
          <p className="text-slate-600">
            {t('logs.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : logs && logs.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('logs.recentActivity')}</CardTitle>
              <CardDescription>
                {t('logs.showingLatest').replace('{count}', logs.length.toString())}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{log.action}</h4>
                          {log.details && (
                            <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                        {log.deviceId && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">{t('logs.device')}:</span> {log.deviceId}
                          </span>
                        )}
                        {log.accountId && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">{t('logs.accountId')}:</span> {log.accountId}
                          </span>
                        )}
                      </div>
                      {log.errorMessage && (
                        <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                          <p className="text-sm text-red-700">
                            <span className="font-medium">{t('logs.error')}:</span> {log.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {t('logs.noLogs')}
                </h3>
                <p className="text-slate-600">
                  {t('logs.noLogsSubtitle')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
