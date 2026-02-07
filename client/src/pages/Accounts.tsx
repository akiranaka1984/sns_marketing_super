import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Power,
  Trash2,
  Loader2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type Platform = "all" | "twitter" | "facebook" | "instagram" | "tiktok";
type SortField = "username" | "status" | "createdAt";
type SortOrder = "asc" | "desc";

// Notion-style status tag
function StatusTag({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: "bg-[#DBEDDB]", text: "text-[#1F7A1F]", dot: "bg-[#1F7A1F]" },
    pending: { bg: "bg-[#FADEC9]", text: "text-[#9F6B53]", dot: "bg-[#D9730D]" },
    failed: { bg: "bg-[#FFE2DD]", text: "text-[#93391E]", dot: "bg-[#E03E3E]" },
    suspended: { bg: "bg-[#FFE2DD]", text: "text-[#93391E]", dot: "bg-[#E03E3E]" },
  };
  const { bg, text, dot } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[12px] ${bg} ${text}`}>
      <span className={`w-[6px] h-[6px] rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// Notion-style plan tag
function PlanTag({ plan }: { plan: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    free: { bg: "bg-[#F1F1EF]", text: "text-[#787774]" },
    premium: { bg: "bg-[#D3E5EF]", text: "text-[#2B6B8A]" },
    premium_plus: { bg: "bg-[#FDECC8]", text: "text-[#9F6B53]" },
  };
  const labels: Record<string, string> = {
    free: "Free",
    premium: "Pro",
    premium_plus: "Pro+",
  };
  const { bg, text } = config[plan] || config.free;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[12px] ${bg} ${text}`}>
      {labels[plan] || plan}
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

export default function Accounts() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => {
      toast.success("アカウントを削除しました");
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`削除失敗: ${error.message}`);
    },
  });

  const activateMutation = trpc.accounts.activate.useMutation({
    onSuccess: () => {
      toast.success("アカウントをアクティブ化しました");
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`アクティブ化失敗: ${error.message}`);
    },
  });

  const batchActivateMutation = trpc.accounts.batchActivate.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.accounts.list.invalidate();
    },
    onError: (error) => {
      toast.error(`一括アクティブ化失敗: ${error.message}`);
    },
  });

  const handleDelete = (accountId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("このアカウントを削除してもよろしいですか？")) {
      deleteMutation.mutate({ accountId });
    }
  };

  const handleActivate = (accountId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    activateMutation.mutate({ accountId });
  };

  const getPlatformEmoji = (platform: string) => {
    const emojis: Record<string, string> = {
      twitter: "𝕏",
      tiktok: "🎵",
      instagram: "📷",
      facebook: "👥",
    };
    return emojis[platform] || "📱";
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      twitter: "X (Twitter)",
      tiktok: "TikTok",
      instagram: "Instagram",
      facebook: "Facebook",
    };
    return names[platform] || platform;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter and sort accounts
  const filteredAndSortedAccounts = accounts
    ? accounts
        .filter(account => selectedPlatform === "all" || account.platform === selectedPlatform)
        .sort((a, b) => {
          let comparison = 0;
          switch (sortField) {
            case "username":
              comparison = a.username.localeCompare(b.username);
              break;
            case "status":
              comparison = a.status.localeCompare(b.status);
              break;
            case "createdAt":
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
          }
          return sortOrder === "asc" ? comparison : -comparison;
        })
    : [];

  // Count accounts by platform
  const platformCounts = accounts
    ? {
        all: accounts.length,
        twitter: accounts.filter(a => a.platform === "twitter").length,
        facebook: accounts.filter(a => a.platform === "facebook").length,
        instagram: accounts.filter(a => a.platform === "instagram").length,
        tiktok: accounts.filter(a => a.platform === "tiktok").length,
      }
    : { all: 0, twitter: 0, facebook: 0, instagram: 0, tiktok: 0 };

  const activeCount = accounts?.filter(a => a.status === 'active').length || 0;
  const pendingCount = accounts?.filter(a => a.status === 'pending').length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#9B9A97]" />
          <span className="text-[13px] text-[#9B9A97]">読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Page Title - Notion style */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[40px]">👥</span>
          <h1 className="text-[32px] font-bold text-[#37352F]">アカウント</h1>
        </div>
        <p className="text-[14px] text-[#9B9A97]">
          SNSアカウントの管理・監視
        </p>
      </div>

      {/* Quick Stats - Notion callout style */}
      <div className="bg-[#F7F6F3] rounded-[4px] p-4 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <PropertyPill label="アカウント総数" value={platformCounts.all} />
          <PropertyPill label="アクティブ" value={activeCount} />
          <PropertyPill label="保留中" value={pendingCount} />
          <div className="flex-1" />
          {pendingCount > 0 && (
            <button
              onClick={() => batchActivateMutation.mutate()}
              disabled={batchActivateMutation.isPending}
              className="flex items-center gap-1 text-[13px] text-[#1F7A1F] hover:underline disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              一括アクティブ化
            </button>
          )}
          <Link href="/accounts/new" className="flex items-center gap-1 text-[13px] text-[#2383E2] hover:underline">
            <Plus className="w-3.5 h-3.5" />
            アカウント追加
          </Link>
        </div>
      </div>

      {/* Platform Filter Tabs - Notion style */}
      <div className="flex items-center gap-1 mb-4">
        {([
          { key: "all" as Platform, label: "すべて", emoji: "📋" },
          { key: "twitter" as Platform, label: "X", emoji: "𝕏" },
          { key: "instagram" as Platform, label: "Instagram", emoji: "📷" },
          { key: "tiktok" as Platform, label: "TikTok", emoji: "🎵" },
          { key: "facebook" as Platform, label: "Facebook", emoji: "👥" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedPlatform(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[13px] transition-colors ${
              selectedPlatform === tab.key
                ? "bg-[#EBEBEA] text-[#37352F] font-medium"
                : "text-[#9B9A97] hover:bg-[#F7F6F3]"
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
            <span className="text-[12px] text-[#9B9A97]">
              {platformCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Database View - Notion style */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#9B9A97] hover:bg-[#EBEBEA] rounded-[4px] transition-colors">
              <Filter className="w-3.5 h-3.5" />
              フィルター
            </button>
            <button className="flex items-center gap-1 px-2 py-1 text-[12px] text-[#9B9A97] hover:bg-[#EBEBEA] rounded-[4px] transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5" />
              ソート
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="border border-[#E9E9E7] rounded-[4px] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_140px_100px_80px_120px_60px] bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <button
              onClick={() => handleSort("username")}
              className="px-3 py-2 text-[12px] font-medium text-[#9B9A97] text-left hover:text-[#37352F] flex items-center gap-1"
            >
              名前
              {sortField === "username" && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">プラットフォーム</div>
            <button
              onClick={() => handleSort("status")}
              className="px-3 py-2 text-[12px] font-medium text-[#9B9A97] text-left hover:text-[#37352F] flex items-center gap-1"
            >
              ステータス
              {sortField === "status" && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">プラン</div>
            <button
              onClick={() => handleSort("createdAt")}
              className="px-3 py-2 text-[12px] font-medium text-[#9B9A97] text-left hover:text-[#37352F] flex items-center gap-1"
            >
              作成日
              {sortField === "createdAt" && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]"></div>
          </div>

          {/* Rows */}
          {filteredAndSortedAccounts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[13px] text-[#9B9A97] mb-3">アカウントがありません</p>
              <Link
                href="/accounts/new"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2383E2] text-white text-[13px] rounded-[4px] hover:bg-[#0B6BCB] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                新規作成
              </Link>
            </div>
          ) : (
            filteredAndSortedAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => navigate(`/accounts/${account.id}`)}
                className="grid grid-cols-[1fr_140px_100px_80px_120px_60px] border-b border-[#E9E9E7] last:border-b-0 hover:bg-[#F7F6F3] transition-colors cursor-pointer group"
              >
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <span className="text-[14px]">{getPlatformEmoji(account.platform)}</span>
                  <div className="min-w-0">
                    <span className="text-[14px] text-[#37352F] group-hover:text-[#2383E2] truncate block">
                      {account.username}
                    </span>
                    {(account as any).xHandle && (
                      <span className="text-[11px] text-[#9B9A97]">@{(account as any).xHandle}</span>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2.5 text-[13px] text-[#787774]">
                  {getPlatformName(account.platform)}
                </div>
                <div className="px-3 py-2.5">
                  <StatusTag status={account.status} />
                </div>
                <div className="px-3 py-2.5">
                  {account.platform === 'twitter' ? (
                    <PlanTag plan={(account as any).planType || 'free'} />
                  ) : (
                    <span className="text-[12px] text-[#9B9A97]">—</span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-[13px] text-[#9B9A97]">
                  {new Date(account.createdAt).toLocaleDateString('ja-JP')}
                </div>
                <div className="px-3 py-2.5 flex items-center justify-end gap-1">
                  {account.status === 'pending' && (
                    <button
                      onClick={(e) => handleActivate(account.id, e)}
                      disabled={activateMutation.isPending}
                      title="アクティブ化"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#DBEDDB] rounded-[4px] transition-all text-[#1F7A1F]"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(account.id, e)}
                    disabled={deleteMutation.isPending}
                    title="削除"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#FFE2DD] rounded-[4px] transition-all text-[#E03E3E]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#EBEBEA] rounded-[4px] transition-all">
                    <MoreHorizontal className="w-4 h-4 text-[#9B9A97]" />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Add Row */}
          {filteredAndSortedAccounts.length > 0 && (
            <Link
              href="/accounts/new"
              className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#9B9A97] hover:bg-[#F7F6F3] transition-colors border-t border-[#E9E9E7]"
            >
              <Plus className="w-3.5 h-3.5" />
              新規追加
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
