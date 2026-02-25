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

// Neobrutalism status tag
function StatusTag({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: "bg-[#A8E6CF]", text: "text-[#1A1A1A]", dot: "bg-[#047857]" },
    success: { bg: "bg-[#A8E6CF]", text: "text-[#1A1A1A]", dot: "bg-[#047857]" },
    pending: { bg: "bg-[#FFD700]", text: "text-[#1A1A1A]", dot: "bg-[#B45309]" },
    failed: { bg: "bg-[#FF6B6B]", text: "text-[#1A1A1A]", dot: "bg-[#B91C1C]" },
  };
  const { bg, text, dot } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#1A1A1A] text-[11px] font-bold shadow-[2px_2px_0_#1A1A1A] ${bg} ${text}`}>
      <span className={`w-[5px] h-[5px] rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// Neobrutalism property pill
function PropertyPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-[#6B6B6B] font-bold">{label}</span>
      <span className="text-[#1A1A1A] font-bold">{value}</span>
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
      {/* Page Title - Neobrutalism */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-lg bg-[#87CEEB] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] flex items-center justify-center">
            <span className="text-[28px]">🏠</span>
          </div>
          <div>
            <h1 className="text-[26px] font-bold text-[#1A1A1A] tracking-tight">ホーム</h1>
            <p className="text-[13px] text-[#6B6B6B] font-bold">
              {new Date().toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats - Neobrutalism callout */}
      <div className="bg-[#FFDAB9] rounded-lg p-5 mb-8 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-8 flex-wrap">
          <PropertyPill label="アカウント総数" value={totalAccounts} />
          <div className="w-px h-5 bg-[#1A1A1A]" />
          <PropertyPill label="アクティブ" value={activeAccounts} />
          <div className="w-px h-5 bg-[#1A1A1A]" />
          <PropertyPill label="保留中" value={pendingAccounts} />
          <div className="flex-1" />
          <Link href="/accounts/new" className="flex items-center gap-1.5 text-[13px] text-[#1A1A1A] hover:text-[#6B6B6B] font-bold transition-colors">
            <Plus className="w-4 h-4" />
            アカウント追加
          </Link>
        </div>
      </div>

      {/* Accounts Database View */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#DDA0DD] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] flex items-center justify-center text-[14px]">👥</span>
            アカウント
          </h2>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 font-bold">
              <Filter className="w-3.5 h-3.5" />
              フィルター
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#1A1A1A] bg-[#FFFDF7] hover:bg-[#FFF8DC] border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 font-bold">
              <ArrowUpDown className="w-3.5 h-3.5" />
              ソート
            </button>
            <Link href="/accounts" className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-[#1A1A1A] bg-[#FFD700] hover:bg-[#FFED4A] border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 font-bold">
              すべて表示
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Table View */}
        <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden bg-[#FFFDF7] shadow-[4px_4px_0_#1A1A1A]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_110px_140px] bg-[#FFD700] border-b-2 border-[#1A1A1A]">
            <div className="px-4 py-3 text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">名前</div>
            <div className="px-4 py-3 text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">プラットフォーム</div>
            <div className="px-4 py-3 text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">ステータス</div>
            <div className="px-4 py-3 text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">作成日</div>
          </div>

          {/* Rows */}
          {accountsLoading ? (
            <div className="p-8 text-center text-[13px] text-[#6B6B6B] font-bold">
              読み込み中...
            </div>
          ) : accounts && accounts.length > 0 ? (
            accounts.slice(0, 5).map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="grid grid-cols-[1fr_120px_110px_140px] border-b-2 border-[#1A1A1A] last:border-b-0 hover:bg-[#FFF8DC] transition-all duration-150 group"
              >
                <div className="px-4 py-3 flex items-center gap-2.5">
                  <span className="text-[14px]">📱</span>
                  <span className="text-[13px] font-bold text-[#1A1A1A]">
                    {account.username}
                  </span>
                </div>
                <div className="px-4 py-3 text-[13px] text-[#6B6B6B] font-bold capitalize">
                  {account.platform === 'twitter' ? 'X (Twitter)' : account.platform}
                </div>
                <div className="px-4 py-3">
                  <StatusTag status={account.status} />
                </div>
                <div className="px-4 py-3 text-[13px] text-[#6B6B6B] font-bold">
                  {new Date(account.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </Link>
            ))
          ) : (
            <div className="p-10 text-center">
              <p className="text-[13px] text-[#6B6B6B] font-bold mb-4">アカウントがありません</p>
              <Link
                href="/accounts/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FFD700] hover:bg-[#FFED4A] text-[#1A1A1A] text-[13px] font-bold rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200"
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
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#FFF8DC] transition-all duration-150 border-t-2 border-[#1A1A1A] font-bold"
            >
              <Plus className="w-4 h-4" />
              新規追加
            </Link>
          )}
        </div>
      </div>

      {/* Recent Activity - Neobrutalism list style */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] flex items-center justify-center text-[14px]">📝</span>
            最近のアクティビティ
          </h2>
          <Link href="/logs" className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-[#1A1A1A] bg-[#FFD700] hover:bg-[#FFED4A] border-2 border-[#1A1A1A] rounded-lg shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 font-bold">
            すべて表示
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] overflow-hidden">
          {recentLogs && recentLogs.length > 0 ? (
            recentLogs.slice(0, 5).map((log, index) => (
              <div
                key={log.id}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-[#FFF8DC] transition-all duration-150 group ${index !== 0 ? 'border-t-2 border-[#1A1A1A]' : ''}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 border-[#1A1A1A] ${
                  log.status === 'success' ? 'bg-[#A8E6CF]' :
                  log.status === 'failed' ? 'bg-[#FF6B6B]' : 'bg-[#FFD700]'
                }`} />
                <span className="flex-1 text-[13px] text-[#1A1A1A] truncate font-bold">
                  {log.action}
                </span>
                <StatusTag status={log.status} />
                <span className="text-[12px] text-[#6B6B6B] flex-shrink-0 font-bold">
                  {new Date(log.createdAt).toLocaleString('ja-JP', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#FFF8DC] rounded-lg transition-all duration-150 border-2 border-transparent hover:border-[#1A1A1A]">
                  <MoreHorizontal className="w-4 h-4 text-[#1A1A1A]" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-[13px] text-[#6B6B6B] font-bold">
              アクティビティがありません
            </div>
          )}
        </div>
      </div>

      {/* Quick Links - Neobrutalism style */}
      <div>
        <h2 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-lg bg-[#DDA0DD] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] flex items-center justify-center text-[14px]">⚡</span>
          クイックアクション
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/automation"
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#FFD700] hover:bg-[#FFED4A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
              <span className="text-[20px]">⚡</span>
            </div>
            <span className="text-[14px] font-bold text-[#1A1A1A]">自動化設定</span>
          </Link>
          <Link
            href="/strategies/new"
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#87CEEB] hover:bg-[#A8E6CF] shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
              <span className="text-[20px]">💡</span>
            </div>
            <span className="text-[14px] font-bold text-[#1A1A1A]">戦略を生成</span>
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-[#1A1A1A] bg-[#A8E6CF] hover:bg-[#4ECDC4] shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FFFDF7] border-2 border-[#1A1A1A] flex items-center justify-center shadow-[2px_2px_0_#1A1A1A]">
              <span className="text-[20px]">📊</span>
            </div>
            <span className="text-[14px] font-bold text-[#1A1A1A]">分析を見る</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
