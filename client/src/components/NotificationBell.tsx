import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useRealtimeEvents, type RealtimeEvent } from "@/hooks/useRealtimeEvents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useRealtimeEvents({
    onEvent: (event: RealtimeEvent) => {
      const message = getEventMessage(event);
      if (!message) return;

      const notification: Notification = {
        id: `${event.type}-${Date.now()}`,
        type: event.type,
        message,
        timestamp: event.timestamp,
        read: false,
      };

      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);
    },
  });

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    return `${Math.floor(diffHour / 24)}日前`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-1.5 hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] rounded-lg transition-colors"
          aria-label={`通知 ${unreadCount > 0 ? `(${unreadCount}件の未読)` : ''}`}
        >
          <Bell className="w-4.5 h-4.5 text-[#64748B] dark:text-[#9CA3AF]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#EF4444] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0 shadow-lg border-[#E2E8F0] dark:border-[#2D3748]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] dark:border-[#2D3748]">
          <h3 className="text-[13px] font-semibold text-[#1E293B] dark:text-[#E5E7EB]">通知</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-[#5C5CFF] hover:text-[#4747CC] font-medium"
            >
              すべて既読にする
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="w-8 h-8 text-[#CBD5E1] dark:text-[#4B5563] mx-auto mb-2" />
              <p className="text-[12px] text-[#94A3B8]">通知はありません</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-4 py-3 border-b border-[#F3F4F6] dark:border-[#1F2937] last:border-b-0 hover:bg-[#F8FAFC] dark:hover:bg-[#111318] transition-colors ${
                  !notification.read ? "bg-[#EEF2FF]/50 dark:bg-[#312E81]/10" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notification.read ? "bg-[#5C5CFF]" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#1E293B] dark:text-[#E5E7EB] leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] mt-1">
                      {formatTime(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getEventMessage(event: RealtimeEvent): string | null {
  switch (event.type) {
    case "post:published":
      return `投稿が正常に公開されました`;
    case "post:failed":
      return `投稿の公開に失敗しました`;
    case "post:created":
      return `新しい投稿が作成されました`;
    case "engagement:received":
      return `新しいエンゲージメントを受信しました`;
    case "account:status-changed":
      return `アカウントのステータスが変更されました`;
    case "analytics:updated":
      return `分析データが更新されました`;
    case "agent:execution-completed":
      return `エージェントの実行が完了しました`;
    case "automation:task-completed":
      return `自動化タスクが完了しました`;
    default:
      return null;
  }
}
