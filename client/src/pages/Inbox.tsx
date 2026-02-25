import { useState } from "react";
import { Bell, CheckCheck, Clock, AlertTriangle, TrendingUp, MessageSquare, Bot, Zap } from "lucide-react";
import { useRealtimeEvents, type RealtimeEvent } from "@/hooks/useRealtimeEvents";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  category: "system" | "engagement" | "automation" | "analytics";
};

const CATEGORY_CONFIG = {
  system: { label: "システム", color: "#6B7280", icon: <Bell className="w-4 h-4" /> },
  engagement: { label: "エンゲージメント", color: "#4ECDC4", icon: <MessageSquare className="w-4 h-4" /> },
  automation: { label: "自動化", color: "#A8E6CF", icon: <Bot className="w-4 h-4" /> },
  analytics: { label: "分析", color: "#FFD700", icon: <TrendingUp className="w-4 h-4" /> },
};

export default function Inbox() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useRealtimeEvents({
    onEvent: (event: RealtimeEvent) => {
      const notification = eventToNotification(event);
      if (!notification) return;
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
    },
  });

  const filtered = filter === "all"
    ? notifications
    : filter === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications.filter((n) => n.category === filter);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    const d = date;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title font-bold">受信トレイ</h1>
          <p className="page-subtitle font-bold">リアルタイム通知とアクティビティ</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-[#1A1A1A] bg-[#FFF8DC] hover:bg-[#FFD700] rounded-lg transition-colors border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            すべて既読 ({unreadCount})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 bg-[#FFFDF7] rounded-lg p-1 w-fit border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
        {[
          { key: "all", label: "すべて" },
          { key: "unread", label: "未読" },
          { key: "automation", label: "自動化" },
          { key: "engagement", label: "エンゲージメント" },
          { key: "analytics", label: "分析" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f.key
                ? "bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A]"
                : "text-[#6B6B6B] hover:bg-[#FFF8DC]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-12 h-12 text-[#6B6B6B] mx-auto mb-4" />
            <p className="text-[14px] text-[#1A1A1A] font-bold">通知はありません</p>
            <p className="text-[12px] text-[#6B6B6B] font-bold mt-1">
              システムイベントがここに表示されます
            </p>
          </div>
        ) : (
          filtered.map((notification) => {
            const config = CATEGORY_CONFIG[notification.category];
            return (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`flex items-start gap-4 px-5 py-4 border-b-2 border-[#1A1A1A] last:border-b-0 hover:bg-[#FFF8DC] transition-colors cursor-pointer ${
                  !notification.read ? "bg-[#FFD700]/20" : ""
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border-2 border-[#1A1A1A]"
                  style={{ backgroundColor: config.color }}
                >
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-[13px] font-bold ${!notification.read ? "text-[#1A1A1A]" : "text-[#6B6B6B]"}`}>
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] flex-shrink-0 border border-[#1A1A1A]" />
                    )}
                  </div>
                  <p className="text-[12px] text-[#6B6B6B] font-bold mt-0.5 line-clamp-2">
                    {notification.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#6B6B6B] font-bold flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatTime(notification.timestamp)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function eventToNotification(event: RealtimeEvent): NotificationItem | null {
  const base = {
    id: `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: event.timestamp,
    read: false,
  };

  switch (event.type) {
    case "post:published":
      return { ...base, type: event.type, title: "投稿公開完了", description: "投稿が正常に公開されました", category: "automation" };
    case "post:failed":
      return { ...base, type: event.type, title: "投稿公開失敗", description: "投稿の公開に失敗しました。詳細を確認してください。", category: "automation" };
    case "post:created":
      return { ...base, type: event.type, title: "新規投稿作成", description: "新しい投稿が作成されました", category: "automation" };
    case "engagement:received":
      return { ...base, type: event.type, title: "エンゲージメント受信", description: "新しいエンゲージメントを受信しました", category: "engagement" };
    case "account:status-changed":
      return { ...base, type: event.type, title: "アカウント状態変更", description: "アカウントのステータスが変更されました", category: "system" };
    case "analytics:updated":
      return { ...base, type: event.type, title: "分析データ更新", description: "分析データが更新されました", category: "analytics" };
    case "agent:execution-completed":
      return { ...base, type: event.type, title: "エージェント実行完了", description: "エージェントの実行が完了しました", category: "automation" };
    case "automation:task-completed":
      return { ...base, type: event.type, title: "タスク完了", description: "自動化タスクが完了しました", category: "automation" };
    default:
      return null;
  }
}
