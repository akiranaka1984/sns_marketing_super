import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Calendar,
  Heart,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Zap,
  Wrench,
  BarChart3,
} from "lucide-react";

// Notion-style property pill
function PropertyPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span className="text-[#9B9A97]">{label}</span>
      <span className={`font-medium ${color || 'text-[#37352F]'}`}>{value}</span>
    </div>
  );
}

// Notion-style status indicator
function StatusIndicator({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[12px] ${
      active
        ? 'bg-[#DBEDDB] text-[#1F7A1F]'
        : 'bg-[#F1F1EF] text-[#787774]'
    }`}>
      <span className={`w-[6px] h-[6px] rounded-full ${active ? 'bg-[#1F7A1F]' : 'bg-[#787774]'}`} />
      {active ? '稼働中' : '停止中'}
    </span>
  );
}

export default function Automation() {
  // Get statistics
  const freezeStats = trpc.freeze.getStats.useQuery({ days: 30 });
  const scheduledStats = trpc.scheduledPosts.getStats.useQuery({ days: 30 });
  const engagementStats = trpc.engagement.getStats.useQuery({ days: 30 });

  return (
    <div className="min-h-full">
      {/* Page Title - Notion style */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Zap className="w-6 h-6 text-primary" /></div>
          <h1 className="text-[32px] font-bold text-[#37352F]">自動化管理</h1>
        </div>
        <p className="text-[14px] text-[#9B9A97]">
          凍結検知、スケジュール投稿、自動エンゲージメントの統合管理
        </p>
      </div>

      {/* Quick Stats - Notion callout style */}
      <div className="bg-[#F7F6F3] rounded-[4px] p-4 mb-8">
        <div className="flex items-center gap-6 flex-wrap">
          <PropertyPill label="凍結検知" value={`${freezeStats.data?.total || 0}件`} />
          <PropertyPill label="スケジュール投稿" value={`${scheduledStats.data?.total || 0}件`} />
          <PropertyPill label="自動エンゲージメント" value={`${engagementStats.data?.total || 0}件`} />
          <div className="flex-1" />
          <span className="text-[12px] text-[#9B9A97]">過去30日間</span>
        </div>
      </div>

      {/* Automation Features - Notion list style */}
      <div className="mb-8">
        <h2 className="text-[16px] font-semibold text-[#37352F] flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          自動化機能
        </h2>

        <div className="border border-[#E9E9E7] rounded-[4px] overflow-hidden">
          {/* Freeze Detection */}
          <Link
            href="/freeze-detection"
            className="flex items-center gap-4 px-4 py-3 border-b border-[#E9E9E7] hover:bg-[#F7F6F3] transition-colors group"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-[#FDECC8] rounded-[4px]">
              <AlertTriangle className="w-4 h-4 text-[#D9730D]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#37352F] font-medium group-hover:text-[#2383E2]">
                凍結検知・自動対応
              </p>
              <p className="text-[12px] text-[#9B9A97]">
                アカウント凍結を自動検知し、即座に対応
              </p>
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              <div className="text-right">
                <p className="text-[#9B9A97]">検知数</p>
                <p className="text-[#37352F] font-medium">{freezeStats.data?.total || 0}件</p>
              </div>
              <div className="text-right">
                <p className="text-[#9B9A97]">解決率</p>
                <p className="text-[#1F7A1F] font-medium">{freezeStats.data?.resolveRate || 0}%</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9B9A97] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Scheduled Posts */}
          <Link
            href="/scheduled-posts"
            className="flex items-center gap-4 px-4 py-3 border-b border-[#E9E9E7] hover:bg-[#F7F6F3] transition-colors group"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-[#E8DEEE] rounded-[4px]">
              <Calendar className="w-4 h-4 text-[#9065B0]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#37352F] font-medium group-hover:text-[#2383E2]">
                スケジュール投稿
              </p>
              <p className="text-[12px] text-[#9B9A97]">
                指定した日時に自動的に投稿を実行
              </p>
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              <div className="text-right">
                <p className="text-[#9B9A97]">待機中</p>
                <p className="text-[#37352F] font-medium">{scheduledStats.data?.byStatus?.pending || 0}件</p>
              </div>
              <div className="text-right">
                <p className="text-[#9B9A97]">成功率</p>
                <p className="text-[#1F7A1F] font-medium">{scheduledStats.data?.successRate || 0}%</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9B9A97] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Auto Engagement */}
          <Link
            href="/engagement"
            className="flex items-center gap-4 px-4 py-3 hover:bg-[#F7F6F3] transition-colors group"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-[#FFE2DD] rounded-[4px]">
              <Heart className="w-4 h-4 text-[#E03E3E]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#37352F] font-medium group-hover:text-[#2383E2]">
                自動エンゲージメント
              </p>
              <p className="text-[12px] text-[#9B9A97]">
                いいね、フォロー、コメントを自動実行
              </p>
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              <div className="text-right">
                <p className="text-[#9B9A97]">実行数</p>
                <p className="text-[#37352F] font-medium">{engagementStats.data?.total || 0}件</p>
              </div>
              <div className="text-right">
                <p className="text-[#9B9A97]">成功率</p>
                <p className="text-[#1F7A1F] font-medium">{engagementStats.data?.successRate || 0}%</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9B9A97] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </div>

      {/* System Status - Notion database style */}
      <div className="mb-8">
        <h2 className="text-[16px] font-semibold text-[#37352F] flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          システムステータス
        </h2>

        <div className="border border-[#E9E9E7] rounded-[4px] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_150px] bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">システム</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">ステータス</div>
            <div className="px-3 py-2 text-[12px] font-medium text-[#9B9A97]">実行間隔</div>
          </div>

          {/* Rows */}
          <div className="grid grid-cols-[1fr_120px_150px] border-b border-[#E9E9E7] hover:bg-[#F7F6F3] transition-colors">
            <div className="px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1F7A1F]" />
              <span className="text-[14px] text-[#37352F]">凍結検知システム</span>
            </div>
            <div className="px-3 py-2.5">
              <StatusIndicator active={true} />
            </div>
            <div className="px-3 py-2.5 text-[13px] text-[#9B9A97]">
              常時監視
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px_150px] border-b border-[#E9E9E7] hover:bg-[#F7F6F3] transition-colors">
            <div className="px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1F7A1F]" />
              <span className="text-[14px] text-[#37352F]">投稿スケジューラー</span>
            </div>
            <div className="px-3 py-2.5">
              <StatusIndicator active={true} />
            </div>
            <div className="px-3 py-2.5 text-[13px] text-[#9B9A97]">
              1分ごと
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px_150px] hover:bg-[#F7F6F3] transition-colors">
            <div className="px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1F7A1F]" />
              <span className="text-[14px] text-[#37352F]">エンゲージメント実行</span>
            </div>
            <div className="px-3 py-2.5">
              <StatusIndicator active={true} />
            </div>
            <div className="px-3 py-2.5 text-[13px] text-[#9B9A97]">
              5分ごと
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Breakdown - Notion callout style */}
      <div className="grid grid-cols-3 gap-4">
        {/* Freeze Stats */}
        <div className="bg-[#FDECC8]/30 rounded-[4px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#D9730D]" />
            <span className="text-[13px] font-medium text-[#37352F]">凍結タイプ別</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">IPブロック</span>
              <span className="text-[#37352F] font-medium">{freezeStats.data?.byType?.ip_block || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">デバイスブロック</span>
              <span className="text-[#37352F] font-medium">{freezeStats.data?.byType?.device_block || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">アカウント凍結</span>
              <span className="text-[#37352F] font-medium">{freezeStats.data?.byType?.account_freeze || 0}件</span>
            </div>
          </div>
        </div>

        {/* Scheduled Stats */}
        <div className="bg-[#E8DEEE]/30 rounded-[4px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#9065B0]" />
            <span className="text-[13px] font-medium text-[#37352F]">投稿ステータス別</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">待機中</span>
              <span className="text-[#37352F] font-medium">{scheduledStats.data?.byStatus?.pending || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">投稿済み</span>
              <span className="text-[#1F7A1F] font-medium">{scheduledStats.data?.byStatus?.posted || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">失敗</span>
              <span className="text-[#E03E3E] font-medium">{scheduledStats.data?.byStatus?.failed || 0}件</span>
            </div>
          </div>
        </div>

        {/* Engagement Stats */}
        <div className="bg-[#FFE2DD]/30 rounded-[4px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-[#E03E3E]" />
            <span className="text-[13px] font-medium text-[#37352F]">エンゲージメントタイプ別</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">いいね</span>
              <span className="text-[#37352F] font-medium">{engagementStats.data?.byType?.like || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">フォロー</span>
              <span className="text-[#37352F] font-medium">{engagementStats.data?.byType?.follow || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9B9A97]">コメント</span>
              <span className="text-[#37352F] font-medium">{engagementStats.data?.byType?.comment || 0}件</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
