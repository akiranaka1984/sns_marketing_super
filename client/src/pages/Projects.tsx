import { useState } from "react";
import { Link } from "wouter";
import { Plus, Calendar, Target, TrendingUp, Users, MoreVertical, Play, Pause, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Projects() {
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "下書き", variant: "secondary" as const },
      active: { label: "実行中", variant: "default" as const },
      paused: { label: "一時停止", variant: "outline" as const },
      completed: { label: "完了", variant: "outline" as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-green-600" />;
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
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
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">プロジェクト</h1>
          <p className="text-slate-600 mt-1">マーケティングキャンペーンを管理</p>
        </div>
        <Link href="/projects/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            新規プロジェクト
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {!projects || projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              プロジェクトがありません
            </h3>
            <p className="text-slate-600 text-center mb-6 max-w-md">
              最初のマーケティングプロジェクトを作成して、SNSアカウントと戦略を管理しましょう
            </p>
            <Link href="/projects/new">
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                新規プロジェクト作成
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(project.status)}
                    {getStatusBadge(project.status)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/projects/${project.id}`}>詳細を表示</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/projects/${project.id}/edit`}>編集</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          if (confirm("このプロジェクトを削除しますか？")) {
                            deleteMutation.mutate({ id: project.id });
                          }
                        }}
                      >
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link href={`/projects/${project.id}`}>
                  <CardTitle className="text-xl mt-3 hover:text-blue-600 transition-colors cursor-pointer">
                    {project.name}
                  </CardTitle>
                </Link>
                <CardDescription className="line-clamp-2">
                  {project.objective}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Period */}
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(project.startDate)} 〜 {formatDate(project.endDate)}
                    </span>
                  </div>

                  {/* Targets */}
                  {project.targets && (() => {
                    try {
                      const targets = JSON.parse(project.targets);
                      const targetEntries = Object.entries(targets);
                      if (targetEntries.length > 0) {
                        return (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Target className="h-4 w-4" />
                            <span>
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

                  {/* Stats */}
                  <div className="flex items-center gap-4 pt-3 border-t">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Users className="h-4 w-4" />
                      <span>{project.accountCount || 0} アカウント</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <TrendingUp className="h-4 w-4" />
                      <span>{project.postCount || 0} 投稿</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
