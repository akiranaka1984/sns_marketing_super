import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="w-[260px] flex-shrink-0 flex flex-col border-r border-[#1E2035] bg-[#0C0D14]">
        {/* Workspace area */}
        <div className="flex items-center h-[56px] px-4 border-b border-[#1E2035]">
          <div className="flex items-center gap-2.5 flex-1">
            <Skeleton className="w-7 h-7 rounded-md bg-white/[0.06]" />
            <Skeleton className="h-4 w-24 bg-white/[0.06]" />
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5">
          <Skeleton className="h-9 w-full rounded-md bg-white/[0.04]" />
        </div>

        {/* Navigation items */}
        <div className="flex-1 px-3 space-y-1">
          <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />
          <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />

          <div className="pt-4">
            <Skeleton className="h-3 w-16 mb-2 bg-white/[0.04]" />
            <div className="space-y-1">
              <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />
              <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />
              <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />
            </div>
          </div>

          <div className="pt-4">
            <Skeleton className="h-3 w-16 mb-2 bg-white/[0.04]" />
            <div className="space-y-1">
              <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />
              <Skeleton className="h-8 w-full rounded-md bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="px-8 py-6 max-w-[1200px]">
            {/* Page title */}
            <div className="mb-7">
              <Skeleton className="h-6 w-24 mb-1.5" />
              <Skeleton className="h-4 w-48" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-7">
              <Skeleton className="h-[76px] w-full rounded-lg" />
              <Skeleton className="h-[76px] w-full rounded-lg" />
              <Skeleton className="h-[76px] w-full rounded-lg" />
              <Skeleton className="h-[76px] w-full rounded-lg" />
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <Skeleton className="h-9 w-full" />
              <div className="space-y-0">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
