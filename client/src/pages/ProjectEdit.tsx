import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function ProjectEdit() {
  const [, params] = useRoute("/projects/:id/edit");
  const [, setLocation] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;

  const { data: project, isLoading } = trpc.projects.byId.useQuery({ id: projectId });
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [followerTarget, setFollowerTarget] = useState("");
  const [engagementTarget, setEngagementTarget] = useState("");
  const [clickTarget, setClickTarget] = useState("");
  const [conversionTarget, setConversionTarget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "paused" | "completed">("draft");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    console.log('ProjectEdit useEffect - project data:', project);
    if (project) {
      setName(project.name);
      setDescription(project.description || "");

      // Parse targets JSON
      if (project.targets) {
        try {
          const targets = typeof project.targets === 'string'
            ? JSON.parse(project.targets)
            : project.targets;
          setFollowerTarget(targets.followers?.toString() || "");
          setEngagementTarget(targets.engagementRate?.toString() || "");
          setClickTarget(targets.clicks?.toString() || "");
          setConversionTarget(targets.conversions?.toString() || "");
        } catch (e) {
          console.error("Failed to parse targets:", e);
        }
      }

      // Set dates and status
      console.log('Setting dates - startDate:', project.startDate, 'endDate:', project.endDate, 'status:', project.status);
      if (project.startDate) {
        const formattedDate = project.startDate.split('T')[0];
        console.log('Setting startDate to:', formattedDate);
        setStartDate(formattedDate);
      }
      if (project.endDate) {
        const formattedDate = project.endDate.split('T')[0];
        console.log('Setting endDate to:', formattedDate);
        setEndDate(formattedDate);
      }
      if (project.status) {
        console.log('Setting status to:', project.status);
        setStatus(project.status);
      }
    }
  }, [project]);

  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("プロジェクトを更新しました");
      utils.projects.byId.invalidate({ id: projectId });
      utils.projects.list.invalidate();
      setLocation(`/projects/${projectId}`);
    },
    onError: (error) => {
      toast.error(`更新エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("プロジェクトを削除しました");
      utils.projects.list.invalidate();
      setLocation("/projects");
    },
    onError: (error) => {
      toast.error(`削除エラー: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("プロジェクト名を入力してください");
      return;
    }

    // Build targets object
    const targets: Record<string, number> = {};
    if (followerTarget) targets.followers = parseInt(followerTarget);
    if (engagementTarget) targets.engagementRate = parseFloat(engagementTarget);
    if (clickTarget) targets.clicks = parseInt(clickTarget);
    if (conversionTarget) targets.conversions = parseInt(conversionTarget);

    updateMutation.mutate({
      id: projectId,
      name: name.trim(),
      description: description.trim() || undefined,
      targets: Object.keys(targets).length > 0 ? targets : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: projectId });
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <h3 className="font-black text-sm text-[#1A1A1A] mb-1">プロジェクトが見つかりません</h3>
          <p className="text-xs font-bold text-[#6B6B6B] mb-3">指定されたプロジェクトは存在しません</p>
          <Button
            onClick={() => setLocation("/projects")}
            className="bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロジェクト一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Button
          variant="ghost"
          onClick={() => setLocation(`/projects/${projectId}`)}
          className="mb-4 border-2 border-[#1A1A1A] bg-[#FFFDF7] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#FFF8DC] transition-all font-bold text-[#1A1A1A]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          プロジェクト詳細に戻る
        </Button>
        <div className="bg-[#FFD700] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <div>
            <h1 className="text-2xl font-black text-[#1A1A1A]">プロジェクトを編集</h1>
            <p className="font-bold text-[#1A1A1A]/70 text-sm mt-1">
              プロジェクトの基本情報とKPI目標を編集します
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4">
          <h3 className="font-black text-sm text-[#1A1A1A] mb-1">基本情報</h3>
          <p className="text-xs font-bold text-[#6B6B6B] mb-3">
            プロジェクト名と説明を入力してください
          </p>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-bold text-[#1A1A1A]">プロジェクト名 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 春の新商品キャンペーン"
                required
                className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:ring-[#FFD700] focus:border-[#FFD700]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold text-[#1A1A1A]">説明</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="プロジェクトの目的や概要を入力してください"
                rows={4}
                className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:ring-[#FFD700] focus:border-[#FFD700]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="font-bold text-[#1A1A1A]">開始日</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] focus:ring-[#FFD700] focus:border-[#FFD700]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate" className="font-bold text-[#1A1A1A]">終了日</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] focus:ring-[#FFD700] focus:border-[#FFD700]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="font-bold text-[#1A1A1A]">ステータス</Label>
              <Select value={status} onValueChange={(value: "draft" | "active" | "paused" | "completed") => setStatus(value)}>
                <SelectTrigger id="status" className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] focus:ring-[#FFD700]">
                  <SelectValue placeholder="ステータスを選択" />
                </SelectTrigger>
                <SelectContent className="border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7] shadow-[4px_4px_0_#1A1A1A]">
                  <SelectItem value="draft" className="font-bold text-[#1A1A1A] hover:bg-[#FFF8DC]">下書き</SelectItem>
                  <SelectItem value="active" className="font-bold text-[#1A1A1A] hover:bg-[#FFF8DC]">実行中</SelectItem>
                  <SelectItem value="paused" className="font-bold text-[#1A1A1A] hover:bg-[#FFF8DC]">一時停止</SelectItem>
                  <SelectItem value="completed" className="font-bold text-[#1A1A1A] hover:bg-[#FFF8DC]">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] p-4 mt-5">
          <h3 className="font-black text-sm text-[#1A1A1A] mb-1">KPI目標</h3>
          <p className="text-xs font-bold text-[#6B6B6B] mb-3">
            達成したい目標値を設定してください（任意）
          </p>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="followerTarget" className="font-bold text-[#1A1A1A]">フォロワー目標数</Label>
                <Input
                  id="followerTarget"
                  type="number"
                  value={followerTarget}
                  onChange={(e) => setFollowerTarget(e.target.value)}
                  placeholder="例: 10000"
                  min="0"
                  className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:ring-[#FFD700] focus:border-[#FFD700]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engagementTarget" className="font-bold text-[#1A1A1A]">エンゲージメント率目標 (%)</Label>
                <Input
                  id="engagementTarget"
                  type="number"
                  step="0.1"
                  value={engagementTarget}
                  onChange={(e) => setEngagementTarget(e.target.value)}
                  placeholder="例: 5.0"
                  min="0"
                  max="100"
                  className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:ring-[#FFD700] focus:border-[#FFD700]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clickTarget" className="font-bold text-[#1A1A1A]">クリック数目標</Label>
                <Input
                  id="clickTarget"
                  type="number"
                  value={clickTarget}
                  onChange={(e) => setClickTarget(e.target.value)}
                  placeholder="例: 1000"
                  min="0"
                  className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:ring-[#FFD700] focus:border-[#FFD700]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversionTarget" className="font-bold text-[#1A1A1A]">コンバージョン数目標</Label>
                <Input
                  id="conversionTarget"
                  type="number"
                  value={conversionTarget}
                  onChange={(e) => setConversionTarget(e.target.value)}
                  placeholder="例: 100"
                  min="0"
                  className="border-2 border-[#1A1A1A] rounded-lg bg-white font-bold text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:ring-[#FFD700] focus:border-[#FFD700]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-4">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 bg-[#FFD700] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#FFF8DC] transition-all font-black text-base"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                更新中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                更新する
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation(`/projects/${projectId}`)}
            className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#FFF8DC] transition-all font-bold"
          >
            キャンセル
          </Button>
        </div>
      </form>

      <div className="bg-[#FFFDF7] rounded-lg border-2 border-[#FF6B6B] shadow-[4px_4px_0_#FF6B6B] p-4">
        <h3 className="font-black text-sm text-[#FF6B6B] mb-1">危険なゾーン</h3>
        <p className="text-xs font-bold text-[#6B6B6B] mb-3">
          プロジェクトを削除すると、関連するすべてのデータが失われます。この操作は元に戻せません。
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          disabled={deleteMutation.isPending}
          className="bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
        >
          {deleteMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              削除中...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              プロジェクトを削除
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="border-2 border-[#1A1A1A] rounded-lg bg-[#FFFDF7] shadow-[4px_4px_0_#1A1A1A]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-[#1A1A1A]">本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-[#6B6B6B]">
              プロジェクト「{project?.name}」を削除します。この操作は元に戻せません。
              関連するすべてのエージェント、投稿、戦略も削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#FFFDF7] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#FFF8DC] transition-all font-bold">キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#FF6B6B] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
