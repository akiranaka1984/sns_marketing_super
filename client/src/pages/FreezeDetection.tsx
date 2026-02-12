import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  ArrowUpDown,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";

// Notion-style status tag
function StatusTag({ success }: { success: boolean }) {
  return success ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[12px] bg-[#DBEDDB] text-[#1F7A1F]">
      <span className="w-[6px] h-[6px] rounded-full bg-[#1F7A1F]" />
      成功
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[12px] bg-[#FFE2DD] text-[#93391E]">
      <span className="w-[6px] h-[6px] rounded-full bg-[#E03E3E]" />
      失敗
    </span>
  );
}

// Notion-style detection type tag
function DetectionTypeTag({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    ip_block: { bg: "bg-[#FFE2DD]", text: "text-[#93391E]" },
    device_block: { bg: "bg-[#FFE2DD]", text: "text-[#93391E]" },
    account_freeze: { bg: "bg-[#FFE2DD]", text: "text-[#93391E]" },
  };
  const labels: Record<string, string> = {
    ip_block: "IPブロック",
    device_block: "デバイスブロック",
    account_freeze: "アカウント凍結",
  };
  const { bg, text } = config[type] || { bg: "bg-[#F1F1EF]", text: "text-[#787774]" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[12px] ${bg} ${text}`}>
      {labels[type] || type}
    </span>
  );
}

// Notion-style action tag
function ActionTag({ action }: { action: string }) {
  const labels: Record<string, string> = {
    ip_change: "IP変更",
    device_switch: "デバイス切替",
    account_pause: "一時停止",
    none: "対応なし",
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[12px] bg-[#F1F1EF] text-[#787774]">
      {labels[action] || action}
    </span>
  );
}

// Notion-style property pill
function PropertyPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span className="text-[#9B9A97]">{label}</span>
      <span className="text-[#37352F] font-medium">{value}</span>
    </div>
  );
}

export default function FreezeDetection() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  // Queries
  const detectionsQuery = trpc.freeze.getAll.useQuery({ limit: 100 });
  const accountsQuery = trpc.accounts.list.useQuery();

  const filteredDetections = detectionsQuery.data?.filter((detection: any) => {
    if (filterType !== "all" && detection.detectionType !== filterType) return false;
    if (filterAccount !== "all" && detection.accountId.toString() !== filterAccount) return false;
    return true;
  });

  const successCount = filteredDetections?.filter((d: any) => d.actionSuccess).length || 0;
  const failedCount = filteredDetections?.filter((d: any) => !d.actionSuccess).length || 0;

  return (
    <div className="min-h-full">
      {/* Page Title - Notion style */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><ShieldAlert className="w-6 h-6 text-primary" /></div>
          <h1 className="text-[32px] font-bold text-[#37352F]">凍結検知ログ</h1>
        </div>
        <p className="text-[14px] text-[#9B9A97]">
          アカウント凍結の検知履歴と自動対応の結果
        </p>
      </div>

      {/* Quick Stats - Notion callout style */}
      <div className="bg-[#F7F6F3] rounded-[4px] p-4 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <PropertyPill label="検知数" value={`${filteredDetections?.length || 0}件`} />
          <PropertyPill label="成功" value={`${successCount}件`} />
          <PropertyPill label="失敗" value={`${failedCount}件`} />
          <div className="flex-1" />
          <button
            onClick={() => detectionsQuery.refetch()}
            disabled={detectionsQuery.isLoading}
            className="flex items-center gap-1.5 text-[13px] text-[#2383E2] hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${detectionsQuery.isLoading ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>
      </div>

      {/* Filter Section - Notion style */}
      <div className="mb-6">
        <h2 className="text-[16px] font-semibold text-[#37352F] flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" />
          フィルター
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#9B9A97]">検知タイプ</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-[#E9E9E7] rounded-[4px] bg-white text-[#37352F] focus:outline-none focus:border-[#2383E2]"
            >
              <option value="all">すべて</option>
              <option value="ip_block">IPブロック</option>
              <option value="device_block">デバイスブロック</option>
              <option value="account_freeze">アカウント凍結</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#9B9A97]">アカウント</span>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-[#E9E9E7] rounded-[4px] bg-white text-[#37352F] focus:outline-none focus:border-[#2383E2]"
            >
              <option value="all">すべて</option>
              {accountsQuery.data?.map((account) => (
                <option key={account.id} value={account.id.toString()}>
                  {account.username}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Detection Log - Notion database style */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-[#37352F] flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            検知履歴
          </h2>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#9B9A97] hover:bg-[#EBEBEA] rounded-[4px] transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5" />
              ソート
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="border border-[#E9E9E7] rounded-[4px] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[180px_1fr_120px_100px_80px_1fr] bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">検知日時</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">アカウント</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">検知タイプ</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">自動対応</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">結果</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">詳細</div>
          </div>

          {/* Rows */}
          {detectionsQuery.isLoading ? (
            <div className="p-8 text-center text-[13px] text-[#9B9A97]">
              読み込み中...
            </div>
          ) : filteredDetections && filteredDetections.length > 0 ? (
            filteredDetections.map((detection: any) => {
              const account = accountsQuery.data?.find((a) => a.id === detection.accountId);
              return (
                <div
                  key={detection.id}
                  className="grid grid-cols-[180px_1fr_120px_100px_80px_1fr] border-b border-[#E9E9E7] last:border-b-0 hover:bg-[#F7F6F3] transition-colors"
                >
                  <div className="px-3 py-2.5 text-[13px] text-[#37352F]">
                    {new Date(detection.detectedAt).toLocaleString("ja-JP", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="px-3 py-2.5 text-[13px] text-[#37352F]">
                    {account?.username || `ID: ${detection.accountId}`}
                  </div>
                  <div className="px-3 py-2.5">
                    <DetectionTypeTag type={detection.detectionType} />
                  </div>
                  <div className="px-3 py-2.5">
                    <ActionTag action={detection.autoAction} />
                  </div>
                  <div className="px-3 py-2.5">
                    <StatusTag success={detection.actionSuccess} />
                  </div>
                  <div className="px-3 py-2.5 text-[13px] text-[#9B9A97] truncate">
                    {detection.details || "—"}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <AlertTriangle className="w-10 h-10 text-[#9B9A97] mx-auto mb-3 opacity-50" />
              <p className="text-[13px] text-[#9B9A97]">検知記録がありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
