import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Notion-style Sidebar skeleton */}
      <div className="w-[240px] flex-shrink-0 bg-[#F7F6F3] flex flex-col border-r border-[#E9E9E7]">
        {/* Workspace area */}
        <div className="flex items-center h-[45px] px-3 border-b border-[#E9E9E7]/60">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="w-5 h-5 rounded-[3px]" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Search */}
        <div className="px-2 py-2">
          <Skeleton className="h-8 w-full rounded-[4px]" />
        </div>

        {/* Navigation items */}
        <div className="flex-1 px-2 space-y-1">
          <Skeleton className="h-7 w-full rounded-[4px]" />
          <Skeleton className="h-7 w-full rounded-[4px]" />

          <div className="pt-3">
            <Skeleton className="h-4 w-16 mb-2" />
            <div className="space-y-1">
              <Skeleton className="h-7 w-full rounded-[4px]" />
              <Skeleton className="h-7 w-full rounded-[4px]" />
              <Skeleton className="h-7 w-full rounded-[4px]" />
            </div>
          </div>

          <div className="pt-3">
            <Skeleton className="h-4 w-16 mb-2" />
            <div className="space-y-1">
              <Skeleton className="h-7 w-full rounded-[4px]" />
              <Skeleton className="h-7 w-full rounded-[4px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[45px] flex items-center justify-between px-4 border-b border-[#E9E9E7] flex-shrink-0 bg-white">
          <div />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-12 rounded-[4px]" />
            <Skeleton className="h-7 w-7 rounded-[4px]" />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="px-8 py-6">
            {/* Page title */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="w-10 h-10 rounded-[4px]" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>

            {/* Callout */}
            <Skeleton className="h-14 w-full rounded-[4px] mb-8" />

            {/* Table */}
            <div className="border border-[#E9E9E7] rounded-[4px] overflow-hidden">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-0">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
