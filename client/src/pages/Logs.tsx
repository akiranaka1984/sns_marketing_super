import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, Clock, ClipboardList } from "lucide-react";
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
        return 'bg-emerald-50 text-emerald-700';
      case 'failed':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-amber-50 text-amber-700';
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title">{t('logs.title')}</h1>
          <p className="page-subtitle">{t('logs.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#A3A3A3]" />
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">{t('logs.recentActivity')}</h3>
          <p className="text-xs text-[#A3A3A3] mb-4">
            {t('logs.showingLatest').replace('{count}', logs.length.toString())}
          </p>
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#1A1A1A]">{log.action}</h4>
                      {log.details && (
                        <p className="text-sm text-[#737373] mt-1">{log.details}</p>
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
                  <div className="flex items-center gap-4 text-xs text-[#A3A3A3]">
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
        </div>
      ) : (
        <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">
              {t('logs.noLogs')}
            </h3>
            <p className="text-[#A3A3A3]">
              {t('logs.noLogsSubtitle')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
