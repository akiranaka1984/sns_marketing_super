import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Calendar,
  Heart,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// Neobrutalism property pill
function PropertyPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span className="text-[#6B6B6B] font-bold">{label}</span>
      <span className={`font-bold ${color || 'text-[#1A1A1A]'}`}>{value}</span>
    </div>
  );
}

// Neobrutalism status indicator
function StatusIndicator({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[12px] font-bold border-2 ${
      active
        ? 'bg-[#A8E6CF] text-[#1A1A1A] border-[#1A1A1A]'
        : 'bg-[#FFFDF7] text-[#6B6B6B] border-[#1A1A1A]'
    }`}>
      <span className={`w-[6px] h-[6px] rounded-full ${active ? 'bg-[#1A1A1A]' : 'bg-[#6B6B6B]'}`} />
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
      {/* Page Title - Neobrutalism style */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[40px]">⚡</span>
          <h1 className="text-[32px] font-bold text-[#1A1A1A]">自動化管理</h1>
        </div>
        <p className="text-[14px] text-[#6B6B6B] font-bold">
          凍結検知、スケジュール投稿、自動エンゲージメントの統合管理
        </p>
      </div>

      {/* Quick Stats - Neobrutalism callout style */}
      <div className="bg-[#FFD700] rounded-lg p-4 mb-8 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-6 flex-wrap">
          <PropertyPill label="凍結検知" value={`${freezeStats.data?.total || 0}件`} />
          <PropertyPill label="スケジュール投稿" value={`${scheduledStats.data?.total || 0}件`} />
          <PropertyPill label="自動エンゲージメント" value={`${engagementStats.data?.total || 0}件`} />
          <div className="flex-1" />
          <span className="text-[12px] text-[#1A1A1A] font-bold">過去30日間</span>
        </div>
      </div>

      {/* Automation Features - Neobrutalism list style */}
      <div className="mb-8">
        <h2 className="text-[16px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-3">
          <span>🔧</span>
          自動化機能
        </h2>

        <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          {/* Freeze Detection */}
          <Link
            href="/freeze-detection"
            className="flex items-center gap-4 px-4 py-3 border-b-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors group bg-[#FFFDF7]"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-[#FFDAB9] rounded-lg border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
              <AlertTriangle className="w-4 h-4 text-[#1A1A1A]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#1A1A1A] font-bold">
                凍結検知・自動対応
              </p>
              <p className="text-[12px] text-[#6B6B6B] font-bold">
                アカウント凍結を自動検知し、即座に対応
              </p>
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              <div className="text-right">
                <p className="text-[#6B6B6B] font-bold">検知数</p>
                <p className="text-[#1A1A1A] font-bold">{freezeStats.data?.total || 0}件</p>
              </div>
              <div className="text-right">
                <p className="text-[#6B6B6B] font-bold">解決率</p>
                <p className="text-[#1A1A1A] font-bold">{freezeStats.data?.resolveRate || 0}%</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B6B6B] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Scheduled Posts */}
          <Link
            href="/scheduled-posts"
            className="flex items-center gap-4 px-4 py-3 border-b-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors group bg-[#FFFDF7]"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-[#DDA0DD] rounded-lg border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
              <Calendar className="w-4 h-4 text-[#1A1A1A]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#1A1A1A] font-bold">
                スケジュール投稿
              </p>
              <p className="text-[12px] text-[#6B6B6B] font-bold">
                指定した日時に自動的に投稿を実行
              </p>
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              <div className="text-right">
                <p className="text-[#6B6B6B] font-bold">待機中</p>
                <p className="text-[#1A1A1A] font-bold">{scheduledStats.data?.byStatus?.pending || 0}件</p>
              </div>
              <div className="text-right">
                <p className="text-[#6B6B6B] font-bold">成功率</p>
                <p className="text-[#1A1A1A] font-bold">{scheduledStats.data?.successRate || 0}%</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B6B6B] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Auto Engagement */}
          <Link
            href="/engagement"
            className="flex items-center gap-4 px-4 py-3 hover:bg-[#FFF8DC] transition-colors group bg-[#FFFDF7]"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-[#FF6B6B] rounded-lg border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]">
              <Heart className="w-4 h-4 text-[#1A1A1A]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#1A1A1A] font-bold">
                自動エンゲージメント
              </p>
              <p className="text-[12px] text-[#6B6B6B] font-bold">
                いいね、フォロー、コメントを自動実行
              </p>
            </div>
            <div className="flex items-center gap-4 text-[13px]">
              <div className="text-right">
                <p className="text-[#6B6B6B] font-bold">実行数</p>
                <p className="text-[#1A1A1A] font-bold">{engagementStats.data?.total || 0}件</p>
              </div>
              <div className="text-right">
                <p className="text-[#6B6B6B] font-bold">成功率</p>
                <p className="text-[#1A1A1A] font-bold">{engagementStats.data?.successRate || 0}%</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B6B6B] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </div>

      {/* System Status - Neobrutalism database style */}
      <div className="mb-8">
        <h2 className="text-[16px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-3">
          <span>📊</span>
          システムステータス
        </h2>

        <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[4px_4px_0_#1A1A1A]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_150px] bg-[#FFD700] border-b-2 border-[#1A1A1A]">
            <div className="px-3 py-2 text-[12px] font-bold text-[#1A1A1A]">システム</div>
            <div className="px-3 py-2 text-[12px] font-bold text-[#1A1A1A]">ステータス</div>
            <div className="px-3 py-2 text-[12px] font-bold text-[#1A1A1A]">実行間隔</div>
          </div>

          {/* Rows */}
          <div className="grid grid-cols-[1fr_120px_150px] border-b-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors bg-[#FFFDF7]">
            <div className="px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1A1A1A]" />
              <span className="text-[14px] text-[#1A1A1A] font-bold">凍結検知システム</span>
            </div>
            <div className="px-3 py-2.5">
              <StatusIndicator active={true} />
            </div>
            <div className="px-3 py-2.5 text-[13px] text-[#6B6B6B] font-bold">
              常時監視
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px_150px] border-b-2 border-[#1A1A1A] hover:bg-[#FFF8DC] transition-colors bg-[#FFFDF7]">
            <div className="px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1A1A1A]" />
              <span className="text-[14px] text-[#1A1A1A] font-bold">投稿スケジューラー</span>
            </div>
            <div className="px-3 py-2.5">
              <StatusIndicator active={true} />
            </div>
            <div className="px-3 py-2.5 text-[13px] text-[#6B6B6B] font-bold">
              1分ごと
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px_150px] hover:bg-[#FFF8DC] transition-colors bg-[#FFFDF7]">
            <div className="px-3 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1A1A1A]" />
              <span className="text-[14px] text-[#1A1A1A] font-bold">エンゲージメント実行</span>
            </div>
            <div className="px-3 py-2.5">
              <StatusIndicator active={true} />
            </div>
            <div className="px-3 py-2.5 text-[13px] text-[#6B6B6B] font-bold">
              5分ごと
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Breakdown - Neobrutalism callout style */}
      <div className="grid grid-cols-3 gap-4">
        {/* Freeze Stats */}
        <div className="bg-[#FFDAB9] rounded-lg p-4 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#1A1A1A]" />
            <span className="text-[13px] font-bold text-[#1A1A1A]">凍結タイプ別</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">IPブロック</span>
              <span className="text-[#1A1A1A] font-bold">{freezeStats.data?.byType?.ip_block || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">デバイスブロック</span>
              <span className="text-[#1A1A1A] font-bold">{freezeStats.data?.byType?.device_block || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">アカウント凍結</span>
              <span className="text-[#1A1A1A] font-bold">{freezeStats.data?.byType?.account_freeze || 0}件</span>
            </div>
          </div>
        </div>

        {/* Scheduled Stats */}
        <div className="bg-[#DDA0DD] rounded-lg p-4 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#1A1A1A]" />
            <span className="text-[13px] font-bold text-[#1A1A1A]">投稿ステータス別</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">待機中</span>
              <span className="text-[#1A1A1A] font-bold">{scheduledStats.data?.byStatus?.pending || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">投稿済み</span>
              <span className="text-[#1A1A1A] font-bold">{scheduledStats.data?.byStatus?.posted || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">失敗</span>
              <span className="text-[#1A1A1A] font-bold">{scheduledStats.data?.byStatus?.failed || 0}件</span>
            </div>
          </div>
        </div>

        {/* Engagement Stats */}
        <div className="bg-[#FF6B6B] rounded-lg p-4 border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-[#1A1A1A]" />
            <span className="text-[13px] font-bold text-[#1A1A1A]">エンゲージメントタイプ別</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">いいね</span>
              <span className="text-[#1A1A1A] font-bold">{engagementStats.data?.byType?.like || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">フォロー</span>
              <span className="text-[#1A1A1A] font-bold">{engagementStats.data?.byType?.follow || 0}件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B6B6B] font-bold">コメント</span>
              <span className="text-[#1A1A1A] font-bold">{engagementStats.data?.byType?.comment || 0}件</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
