import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        // Handle both Date objects and ISO strings
        const dateStr = typeof project.startDate === 'string' 
          ? project.startDate 
          : project.startDate.toISOString();
        const formattedDate = dateStr.split('T')[0];
        console.log('Setting startDate to:', formattedDate);
        setStartDate(formattedDate);
      }
      if (project.endDate) {
        // Handle both Date objects and ISO strings
        const dateStr = typeof project.endDate === 'string' 
          ? project.endDate 
          : project.endDate.toISOString();
        const formattedDate = dateStr.split('T')[0];
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>プロジェクトが見つかりません</CardTitle>
            <CardDescription>指定されたプロジェクトは存在しません</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/projects")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              プロジェクト一覧に戻る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation(`/projects/${projectId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          プロジェクト詳細に戻る
        </Button>
        <h1 className="text-3xl font-bold">プロジェクトを編集</h1>
        <p className="text-muted-foreground mt-2">
          プロジェクトの基本情報とKPI目標を編集します
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
            <CardDescription>
              プロジェクト名と説明を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">プロジェクト名 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 春の新商品キャンペーン"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="プロジェクトの目的や概要を入力してください"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="startDate">開始日</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">終了日</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <Select value={status} onValueChange={(value: "draft" | "active" | "paused" | "completed") => setStatus(value)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="ステータスを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">下書き</SelectItem>
                  <SelectItem value="active">実行中</SelectItem>
                  <SelectItem value="paused">一時停止</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>KPI目標</CardTitle>
            <CardDescription>
              達成したい目標値を設定してください（任意）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="followerTarget">フォロワー目標数</Label>
                <Input
                  id="followerTarget"
                  type="number"
                  value={followerTarget}
                  onChange={(e) => setFollowerTarget(e.target.value)}
                  placeholder="例: 10000"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engagementTarget">エンゲージメント率目標 (%)</Label>
                <Input
                  id="engagementTarget"
                  type="number"
                  step="0.1"
                  value={engagementTarget}
                  onChange={(e) => setEngagementTarget(e.target.value)}
                  placeholder="例: 5.0"
                  min="0"
                  max="100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clickTarget">クリック数目標</Label>
                <Input
                  id="clickTarget"
                  type="number"
                  value={clickTarget}
                  onChange={(e) => setClickTarget(e.target.value)}
                  placeholder="例: 1000"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversionTarget">コンバージョン数目標</Label>
                <Input
                  id="conversionTarget"
                  type="number"
                  value={conversionTarget}
                  onChange={(e) => setConversionTarget(e.target.value)}
                  placeholder="例: 100"
                  min="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-4">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1"
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
          >
            キャンセル
          </Button>
        </div>
      </form>

      <Card className="mt-6 border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">危険なゾーン</CardTitle>
          <CardDescription>
            プロジェクトを削除すると、関連するすべてのデータが失われます。この操作は元に戻せません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteMutation.isPending}
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
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              プロジェクト「{project?.name}」を削除します。この操作は元に戻せません。
              関連するすべてのエージェント、投稿、戦略も削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
