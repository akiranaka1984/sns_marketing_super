import { Link } from "wouter";
import { Plus, Calendar, Target, TrendingUp, Users, MoreVertical, Play, Pause, CheckCircle, Loader2, FolderKanban } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

function StatusPill({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    draft: "bg-[#F5F5F5] text-[#737373] border-[#E5E5E5]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${styles[status] || styles.draft}`}>
      {status === "active" && <Play className="w-2.5 h-2.5" />}
      {status === "paused" && <Pause className="w-2.5 h-2.5" />}
      {status === "completed" && <CheckCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

export default function Projects() {
  const { t } = useI18n();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      toast.success("プロジェクトを削除しました");
    },
    onError: () => {
      toast.error("プロジェクトの削除に失敗しました");
    },
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: t('abTesting.draft'),
      active: t('projects.active'),
      paused: t('projects.paused'),
      completed: t('projects.completed'),
    };
    return labels[status] || status;
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "未設定";
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4380D]" />
          <span className="text-sm text-[#A3A3A3]">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="fade-in-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="section-label mb-1">Projects</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A1A]">
            {t('projects.title')}
          </h1>
          <p className="text-sm text-[#737373] mt-0.5">{t('projects.subtitle')}</p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" className="h-8 text-xs font-semibold bg-[#D4380D] hover:bg-[#B8300B] text-white">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('projects.newProject')}
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {!projects || projects.length === 0 ? (
        <div className="fade-in-up signal-card" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-[#F5F5F5] mb-4">
              <FolderKanban className="h-8 w-8 text-[#A3A3A3]" />
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] mb-1">
              {t('projects.noProjects')}
            </h3>
            <p className="text-xs text-[#737373] text-center mb-5 max-w-sm">
              {t('projects.createFirst')}
            </p>
            <Link href="/projects/new">
              <Button size="sm" className="h-8 text-xs font-semibold bg-[#D4380D] hover:bg-[#B8300B] text-white">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t('projects.newProject')}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((project, idx) => (
            <div
              key={project.id}
              className="fade-in-up signal-card interactive-card p-4"
              style={{ animationDelay: `${(idx + 1) * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <StatusPill status={project.status} label={getStatusLabel(project.status)} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded-md hover:bg-[#F5F5F5] text-[#A3A3A3] transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}`}>{t('accounts.viewDetails')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}/edit`}>{t('common.edit')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => {
                        if (confirm(t('common.confirm'))) {
                          deleteMutation.mutate({ id: project.id });
                        }
                      }}
                    >
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link href={`/projects/${project.id}`}>
                <h3 className="text-sm font-bold text-[#1A1A1A] hover:text-[#D4380D] transition-colors cursor-pointer mb-1 line-clamp-1">
                  {project.name}
                </h3>
              </Link>
              <p className="text-xs text-[#737373] line-clamp-2 mb-3">
                {project.objective}
              </p>

              <div className="space-y-2 pt-3 border-t border-[#F5F5F5]">
                <div className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
                </div>

                {project.targets && (() => {
                  try {
                    const targets = JSON.parse(project.targets);
                    const targetEntries = Object.entries(targets);
                    if (targetEntries.length > 0) {
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
                          <Target className="h-3 w-3" />
                          <span className="truncate">
                            {targetEntries.map(([key, value], index) => (
                              <span key={key}>
                                {index > 0 && " / "}
                                {key}: {typeof value === 'number' ? (value as number).toLocaleString() : String(value)}
                              </span>
                            ))}
                          </span>
                        </div>
                      );
                    }
                  } catch (e) {
                    return null;
                  }
                })()}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[11px] text-[#A3A3A3]">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{project.accountCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#A3A3A3]">
                    <TrendingUp className="h-3 w-3" />
                    <span className="tabular-nums">{project.postCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
