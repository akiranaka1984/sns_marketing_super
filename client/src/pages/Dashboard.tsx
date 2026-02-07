import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  MoreHorizontal,
  Plus,
  Filter,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

// Refined status tag
function StatusTag({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: "bg-[#D1FAE5]", text: "text-[#047857]", dot: "bg-[#10B981]" },
    success: { bg: "bg-[#D1FAE5]", text: "text-[#047857]", dot: "bg-[#10B981]" },
    pending: { bg: "bg-[#FEF3C7]", text: "text-[#B45309]", dot: "bg-[#F59E0B]" },
    failed: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]", dot: "bg-[#EF4444]" },
  };
  const { bg, text, dot } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${bg} ${text}`}>
      <span className={`w-[5px] h-[5px] rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// Refined property pill
function PropertyPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-[#6B7280]">{label}</span>
      <span className="text-[#1A1D21] font-semibold">{value}</span>
    </div>
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
    <div className="min-h-full">
      {/* Page Title - Refined */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5C5CFF]/10 to-[#7C3AED]/10 flex items-center justify-center">
            <span className="text-[28px]">🏠</span>
          </div>
          <div>
            <h1 className="text-[26px] font-bold text-[#1A1D21] tracking-tight">ホーム</h1>
            <p className="text-[13px] text-[#6B7280]">
              {new Date().toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats - Refined callout */}
      <div className="bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9] rounded-xl p-5 mb-8 border border-[#E2E8F0]">
        <div className="flex items-center gap-8 flex-wrap">
          <PropertyPill label="アカウント総数" value={totalAccounts} />
          <div className="w-px h-5 bg-[#E2E8F0]" />
          <PropertyPill label="アクティブ" value={activeAccounts} />
          <div className="w-px h-5 bg-[#E2E8F0]" />
          <PropertyPill label="保留中" value={pendingAccounts} />
          <div className="flex-1" />
          <Link href="/accounts/new" className="flex items-center gap-1.5 text-[13px] text-[#5C5CFF] hover:text-[#4747CC] font-medium transition-colors">
            <Plus className="w-4 h-4" />
            アカウント追加
          </Link>
        </div>
      </div>

      {/* Accounts Database View */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[#1A1D21] flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#EEF2FF] flex items-center justify-center text-[14px]">👥</span>
            アカウント
          </h2>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#64748B] hover:text-[#1A1D21] hover:bg-[#F1F5F9] rounded-lg transition-all duration-150 font-medium">
              <Filter className="w-3.5 h-3.5" />
              フィルター
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#64748B] hover:text-[#1A1D21] hover:bg-[#F1F5F9] rounded-lg transition-all duration-150 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5" />
              ソート
            </button>
            <Link href="/accounts" className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-[#5C5CFF] hover:bg-[#EEF2FF] rounded-lg transition-all duration-150 font-medium">
              すべて表示
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Table View */}
        <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_110px_140px] bg-gradient-to-b from-[#F8FAFC] to-[#F4F5F7] border-b border-[#E5E7EB]">
            <div className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">名前</div>
            <div className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">プラットフォーム</div>
            <div className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">ステータス</div>
            <div className="px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">作成日</div>
          </div>

          {/* Rows */}
          {accountsLoading ? (
            <div className="p-8 text-center text-[13px] text-[#6B7280]">
              読み込み中...
            </div>
          ) : accounts && accounts.length > 0 ? (
            accounts.slice(0, 5).map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="grid grid-cols-[1fr_120px_110px_140px] border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F8FAFC] transition-all duration-150 group"
              >
                <div className="px-4 py-3 flex items-center gap-2.5">
                  <span className="text-[14px]">📱</span>
                  <span className="text-[13px] font-medium text-[#1A1D21] group-hover:text-[#5C5CFF] transition-colors">
                    {account.username}
                  </span>
                </div>
                <div className="px-4 py-3 text-[13px] text-[#64748B] capitalize">
                  {account.platform === 'twitter' ? 'X (Twitter)' : account.platform}
                </div>
                <div className="px-4 py-3">
                  <StatusTag status={account.status} />
                </div>
                <div className="px-4 py-3 text-[13px] text-[#94A3B8]">
                  {new Date(account.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </Link>
            ))
          ) : (
            <div className="p-10 text-center">
              <p className="text-[13px] text-[#6B7280] mb-4">アカウントがありません</p>
              <Link
                href="/accounts/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#5C5CFF] to-[#4747CC] text-white text-[13px] font-medium rounded-lg hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                新規作成
              </Link>
            </div>
          )}

          {/* Add Row */}
          {accounts && accounts.length > 0 && (
            <Link
              href="/accounts/new"
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-[#94A3B8] hover:text-[#5C5CFF] hover:bg-[#F8FAFC] transition-all duration-150 border-t border-[#F3F4F6]"
            >
              <Plus className="w-4 h-4" />
              新規追加
            </Link>
          )}
        </div>
      </div>

      {/* Recent Activity - Refined list style */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[#1A1D21] flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#FEF3C7] flex items-center justify-center text-[14px]">📝</span>
            最近のアクティビティ
          </h2>
          <Link href="/logs" className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-[#5C5CFF] hover:bg-[#EEF2FF] rounded-lg transition-all duration-150 font-medium">
            すべて表示
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          {recentLogs && recentLogs.length > 0 ? (
            recentLogs.slice(0, 5).map((log, index) => (
              <div
                key={log.id}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-[#F8FAFC] transition-all duration-150 group ${index !== 0 ? 'border-t border-[#F3F4F6]' : ''}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  log.status === 'success' ? 'bg-[#10B981]' :
                  log.status === 'failed' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'
                }`} />
                <span className="flex-1 text-[13px] text-[#1A1D21] truncate font-medium">
                  {log.action}
                </span>
                <StatusTag status={log.status} />
                <span className="text-[12px] text-[#94A3B8] flex-shrink-0">
                  {new Date(log.createdAt).toLocaleString('ja-JP', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-all duration-150">
                  <MoreHorizontal className="w-4 h-4 text-[#94A3B8]" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-[13px] text-[#6B7280]">
              アクティビティがありません
            </div>
          )}
        </div>
      </div>

      {/* Quick Links - Refined style */}
      <div>
        <h2 className="text-[15px] font-semibold text-[#1A1D21] flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-md bg-[#EDE9FE] flex items-center justify-center text-[14px]">⚡</span>
          クイックアクション
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/automation"
            className="flex items-center gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#5C5CFF]/30 hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center shadow-sm">
              <span className="text-[20px]">⚡</span>
            </div>
            <span className="text-[14px] font-medium text-[#1A1D21] group-hover:text-[#5C5CFF] transition-colors">自動化設定</span>
          </Link>
          <Link
            href="/strategies/new"
            className="flex items-center gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#5C5CFF]/30 hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] flex items-center justify-center shadow-sm">
              <span className="text-[20px]">💡</span>
            </div>
            <span className="text-[14px] font-medium text-[#1A1D21] group-hover:text-[#5C5CFF] transition-colors">戦略を生成</span>
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-3 p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#5C5CFF]/30 hover:shadow-md transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] flex items-center justify-center shadow-sm">
              <span className="text-[20px]">📊</span>
            </div>
            <span className="text-[14px] font-medium text-[#1A1D21] group-hover:text-[#5C5CFF] transition-colors">分析を見る</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
