import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function NewStrategy() {
  const [, setLocation] = useLocation();
  const [objective, setObjective] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [kpis, setKpis] = useState({
    followers: '',
    engagement: '',
    clicks: '',
    conversions: '',
  });

  const utils = trpc.useUtils();
  const { data: projects } = trpc.projects.list.useQuery();

  const generateMutation = trpc.strategies.generate.useMutation({
    onSuccess: () => {
      toast.success("戦略が正常に生成されました！");
      utils.strategies.list.invalidate();
      utils.projects.byId.invalidate();
      setLocation('/strategies');
    },
    onError: (error) => {
      toast.error(`戦略の生成に失敗しました: ${error.message}`);
    },
  });

  const updateProjectMutation = trpc.projects.update.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!objective.trim()) {
      toast.error("マーケティング目標を入力してください");
      return;
    }

    if (!projectId) {
      toast.error("プロジェクトを選択してください");
      return;
    }

    try {
      // Update project KPIs if any are set
      const targets: Record<string, number> = {};
      if (kpis.followers) targets.followers = parseInt(kpis.followers);
      if (kpis.engagement) targets.engagement = parseFloat(kpis.engagement);
      if (kpis.clicks) targets.clicks = parseInt(kpis.clicks);
      if (kpis.conversions) targets.conversions = parseInt(kpis.conversions);

      if (Object.keys(targets).length > 0) {
        await updateProjectMutation.mutateAsync({
          id: parseInt(projectId),
          targets,
        });
      }

      // Generate strategy
      await generateMutation.mutateAsync({
        objective,
        projectId: parseInt(projectId),
      });
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  };

  const exampleObjectives = [
    "ミレニアル世代をターゲットにした新しいエコフレンドリー製品ラインのブランド認知度を向上させる",
    "ECサイトへのトラフィックを増やし、第1四半期の売上を30%向上させる",
    "サステナブルな生活を中心としたエンゲージメントの高いフォロワーコミュニティを構築する",
    "新しいモバイルアプリをローンチし、初月で10,000ユーザーを獲得する",
  ];

  const handleUseExample = (example: string) => {
    setObjective(example);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="fade-in-up page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-[#D4380D]" />
            戦略生成
          </h1>
          <p className="page-subtitle">AIがあなたの目標に基づいた包括的なマーケティング戦略を作成します</p>
        </div>
      </div>

      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">マーケティング目標</h3>
        <p className="text-xs text-[#A3A3A3] mb-3">マーケティングの目標とターゲットオーディエンスを説明してください。できるだけ具体的に記述してください。</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="project">プロジェクト *</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={generateMutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="プロジェクトを選択" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#A3A3A3]">
              この戦略を紐付けるプロジェクトを選択してください
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">マーケティング目標 *</Label>
            <Textarea
              id="objective"
              placeholder="例：InstagramとTikTokでミレニアル世代をターゲットにした新しいエコフレンドリー製品ラインのブランド認知度を向上させる..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={generateMutation.isPending}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-[#A3A3A3]">
              最低20文字。ターゲットオーディエンス、プラットフォーム、目標についての詳細を含めてください。
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-[#E5E5E5] text-[#1A1A1A]"
              onClick={() => setLocation('/strategies')}
              disabled={generateMutation.isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2 bg-[#D4380D] hover:bg-[#B8300B] text-white"
              disabled={generateMutation.isPending || objective.length < 20 || !projectId}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  戦略を生成
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1 flex items-center gap-2">
          <Target className="h-5 w-5 text-[#D4380D]" />
          KPI目標（オプション）
        </h3>
        <p className="text-xs text-[#A3A3A3] mb-3">プロジェクトの具体的な数値目標を設定します。後から変更することもできます。</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="followers">フォロワー目標数</Label>
            <Input
              id="followers"
              type="number"
              placeholder="例: 10000"
              value={kpis.followers}
              onChange={(e) => setKpis({ ...kpis, followers: e.target.value })}
              disabled={generateMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="engagement">エンゲージメント率目標（%）</Label>
            <Input
              id="engagement"
              type="number"
              step="0.1"
              placeholder="例: 5.5"
              value={kpis.engagement}
              onChange={(e) => setKpis({ ...kpis, engagement: e.target.value })}
              disabled={generateMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clicks">クリック数目標</Label>
            <Input
              id="clicks"
              type="number"
              placeholder="例: 5000"
              value={kpis.clicks}
              onChange={(e) => setKpis({ ...kpis, clicks: e.target.value })}
              disabled={generateMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conversions">コンバージョン数目標</Label>
            <Input
              id="conversions"
              type="number"
              placeholder="例: 500"
              value={kpis.conversions}
              onChange={(e) => setKpis({ ...kpis, conversions: e.target.value })}
              disabled={generateMutation.isPending}
            />
          </div>
        </div>
      </div>

      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">目標の例</h3>
        <p className="text-xs text-[#A3A3A3] mb-3">クリックして例を使用できます</p>
        <div className="space-y-3">
          {exampleObjectives.map((example, index) => (
            <button
              key={index}
              onClick={() => handleUseExample(example)}
              disabled={generateMutation.isPending}
              className="w-full text-left p-4 rounded-lg border border-[#E5E5E5] hover:border-[#D4380D] hover:bg-[#FFF7ED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="text-sm text-[#525252]">{example}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="fade-in-up bg-white rounded-lg border border-[#E5E5E5] p-4">
        <h3 className="font-semibold text-sm text-[#1A1A1A] mb-1">生成される内容</h3>
        <div className="space-y-3 text-sm text-[#737373] mt-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFF7ED] text-[#D4380D] flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
            <div>
              <p className="font-medium text-[#1A1A1A]">コンテンツタイプの推奨</p>
              <p>ターゲットオーディエンスに響くコンテンツの種類</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFF7ED] text-[#D4380D] flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
            <div>
              <p className="font-medium text-[#1A1A1A]">ハッシュタグ戦略</p>
              <p>リーチとエンゲージメントを最大化する関連ハッシュタグ</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFF7ED] text-[#D4380D] flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
            <div>
              <p className="font-medium text-[#1A1A1A]">投稿スケジュール</p>
              <p>コンテンツ投稿の最適な時間と頻度</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFF7ED] text-[#D4380D] flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
            <div>
              <p className="font-medium text-[#1A1A1A]">エンゲージメント戦術</p>
              <p>コミュニティを構築するためのオーディエンスとの交流方法</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFF7ED] text-[#D4380D] flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
            <div>
              <p className="font-medium text-[#1A1A1A]">サンプルコンテンツアイデア</p>
              <p>すぐに使える投稿テンプレートとコンテンツ提案</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
