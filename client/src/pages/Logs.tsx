import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, Clock, ClipboardList } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function Logs() {
  const { t } = useI18n();
  const { data: logs, isLoading } = trpc.logs.recent.useQuery({ limit: 100 });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-[#A8E6CF]" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-[#FF6B6B]" />;
      default:
        return <Clock className="h-5 w-5 text-[#FFD700]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-[#A8E6CF] text-[#1A1A1A] border-2 border-[#1A1A1A]';
      case 'failed':
        return 'bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A]';
      default:
        return 'bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A]';
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
          <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
          <h3 className="font-bold text-sm text-[#1A1A1A] mb-1">{t('logs.recentActivity')}</h3>
          <p className="text-xs text-[#6B6B6B] mb-4 font-bold">
            {t('logs.showingLatest').replace('{count}', logs.length.toString())}
          </p>
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 rounded-lg border-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors bg-white shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-[#1A1A1A]">{log.action}</h4>
                      {log.details && (
                        <p className="text-sm text-[#6B6B6B] mt-1 font-bold">{log.details}</p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${getStatusColor(
                        log.status
                      )}`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6B6B6B] font-bold">
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                    {log.deviceId && (
                      <span className="flex items-center gap-1">
                        <span className="font-bold">{t('logs.device')}:</span> {log.deviceId}
                      </span>
                    )}
                    {log.accountId && (
                      <span className="flex items-center gap-1">
                        <span className="font-bold">{t('logs.accountId')}:</span> {log.accountId}
                      </span>
                    )}
                  </div>
                  {log.errorMessage && (
                    <div className="mt-2 p-3 bg-[#FF6B6B] rounded-lg border-2 border-[#1A1A1A]">
                      <p className="text-sm text-[#1A1A1A] font-bold">
                        <span className="font-bold">{t('logs.error')}:</span> {log.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-[#6B6B6B] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">
              {t('logs.noLogs')}
            </h3>
            <p className="text-[#6B6B6B] font-bold">
              {t('logs.noLogsSubtitle')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
