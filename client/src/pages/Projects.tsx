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
    active: "bg-[#A8E6CF] text-[#1A1A1A] border-[#1A1A1A]",
    paused: "bg-[#FFD700] text-[#1A1A1A] border-[#1A1A1A]",
    completed: "bg-[#87CEEB] text-[#1A1A1A] border-[#1A1A1A]",
    draft: "bg-[#FFFDF7] text-[#6B6B6B] border-[#1A1A1A]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border-2 shadow-[2px_2px_0_#1A1A1A] ${styles[status] || styles.draft}`}>
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

  const formatDate = (date: Date | string | null | undefined) => {
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
        <div className="flex flex-col items-center gap-3 p-8 bg-[#FFD700] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A]">
          <Loader2 className="h-6 w-6 animate-spin text-[#1A1A1A]" />
          <span className="text-sm text-[#1A1A1A] font-bold">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="fade-in-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="section-label mb-1 text-[#6B6B6B] font-bold">Projects</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A1A]">
            {t('projects.title')}
          </h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5 font-bold">{t('projects.subtitle')}</p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" className="h-8 text-xs font-bold bg-[#FFD700] hover:bg-[#FFED4A] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('projects.newProject')}
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {!projects || projects.length === 0 ? (
        <div className="fade-in-up bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A]" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-lg bg-[#FFD700] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] mb-4">
              <FolderKanban className="h-8 w-8 text-[#1A1A1A]" />
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] mb-1">
              {t('projects.noProjects')}
            </h3>
            <p className="text-xs text-[#6B6B6B] text-center mb-5 max-w-sm font-bold">
              {t('projects.createFirst')}
            </p>
            <Link href="/projects/new">
              <Button size="sm" className="h-8 text-xs font-bold bg-[#FFD700] hover:bg-[#FFED4A] text-[#1A1A1A] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
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
              className="fade-in-up bg-[#FFFDF7] border-2 border-[#1A1A1A] rounded-lg shadow-[4px_4px_0_#1A1A1A] hover:shadow-[2px_2px_0_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] transition-all p-4"
              style={{ animationDelay: `${(idx + 1) * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <StatusPill status={project.status} label={getStatusLabel(project.status)} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded-lg hover:bg-[#FFF8DC] text-[#1A1A1A] transition-colors border-2 border-transparent hover:border-[#1A1A1A]">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#FFFDF7] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}`} className="font-bold">{t('accounts.viewDetails')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${project.id}/edit`} className="font-bold">{t('common.edit')}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 font-bold"
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
                <h3 className="text-sm font-bold text-[#1A1A1A] hover:text-[#6B6B6B] transition-colors cursor-pointer mb-1 line-clamp-1">
                  {project.name}
                </h3>
              </Link>
              <p className="text-xs text-[#6B6B6B] line-clamp-2 mb-3 font-bold">
                {project.objective}
              </p>

              <div className="space-y-2 pt-3 border-t-2 border-[#1A1A1A]">
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] font-bold">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
                </div>

                {project.targets && (() => {
                  try {
                    const targets = JSON.parse(project.targets);
                    const targetEntries = Object.entries(targets);
                    if (targetEntries.length > 0) {
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] font-bold">
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
                  <div className="flex items-center gap-1 text-[11px] text-[#6B6B6B] font-bold">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{project.accountCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#6B6B6B] font-bold">
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
