import { Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import ContentCalendar, { type CalendarPost } from "@/components/ContentCalendar";
import { useMemo } from "react";

export default function ContentCalendarPage() {
  const postsQuery = trpc.scheduledPosts.getAll.useQuery({});

  // Map the tRPC response to CalendarPost format
  const calendarPosts: CalendarPost[] = useMemo(() => {
    if (!postsQuery.data) return [];
    return postsQuery.data.map((post) => ({
      id: post.id,
      content: post.content,
      scheduledAt: post.scheduledTime ?? new Date().toISOString(),
      status: post.status as CalendarPost["status"],
      accountId: post.accountId,
    }));
  }, [postsQuery.data]);

  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="fade-in-up page-header mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-lg bg-[#FFD700] flex items-center justify-center border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
            <Calendar className="h-6 w-6 text-[#1A1A1A]" />
          </div>
          <div>
            <h1 className="page-title font-bold text-[#1A1A1A]">
              コンテンツカレンダー
            </h1>
            <p className="page-subtitle font-bold text-[#6B6B6B]">
              投稿スケジュールを視覚的に管理
            </p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="fade-in-up">
        <ContentCalendar
          posts={calendarPosts}
          isLoading={postsQuery.isLoading}
        />
      </div>
    </div>
  );
}
