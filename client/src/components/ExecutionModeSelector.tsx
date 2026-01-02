import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, Eye, Hand, Check } from "lucide-react";
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

type ExecutionMode = "fullAuto" | "confirm" | "manual";

interface ExecutionModeSelectorProps {
  projectId: number;
  currentMode: ExecutionMode;
}

const modeConfig = {
  fullAuto: {
    label: "フルオート",
    icon: Zap,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "AIが生成した投稿を自動承認して投稿",
    details: "エージェントが生成した投稿は即座に承認され、スケジュール通りに自動投稿されます。人の確認は不要です。",
  },
  confirm: {
    label: "確認モード",
    icon: Eye,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "投稿前に内容を確認して承認",
    details: "エージェントが生成した投稿は「レビュー待ち」状態になり、承認後に投稿されます。内容を確認してから投稿できます。",
  },
  manual: {
    label: "手動モード",
    icon: Hand,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description: "すべて手動で投稿を作成・管理",
    details: "AI生成機能は使用せず、すべての投稿を手動で作成・管理します。完全なコントロールが可能です。",
  },
};

export default function ExecutionModeSelector({ projectId, currentMode }: ExecutionModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<ExecutionMode | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const updateModeMutation = trpc.projects.updateMode.useMutation({
    onSuccess: () => {
      toast.success("実行モードを変更しました");
      setIsDialogOpen(false);
      setSelectedMode(null);
      utils.projects.byId.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleModeClick = (mode: ExecutionMode) => {
    if (mode === currentMode) return;
    setSelectedMode(mode);
    setIsDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedMode) return;
    updateModeMutation.mutate({
      id: projectId,
      executionMode: selectedMode,
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(modeConfig) as ExecutionMode[]).map((mode) => {
          const config = modeConfig[mode];
          const Icon = config.icon;
          const isActive = mode === currentMode;

          return (
            <Card
              key={mode}
              className={`relative cursor-pointer transition-all hover:shadow-md ${
                isActive
                  ? `${config.borderColor} border-2 ${config.bgColor}`
                  : "border hover:border-slate-300"
              }`}
              onClick={() => handleModeClick(mode)}
            >
              <div className="p-4">
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <div className={`${config.color} bg-white rounded-full p-1`}>
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`p-2 ${config.bgColor} rounded-lg`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{config.label}</h3>
                    <p className="text-sm text-slate-600">{config.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>実行モードを変更しますか？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {selectedMode && (
                <>
                  <div className="flex items-center gap-2 text-base font-medium text-slate-900">
                    {(() => {
                      const Icon = modeConfig[selectedMode].icon;
                      return <Icon className={`h-5 w-5 ${modeConfig[selectedMode].color}`} />;
                    })()}
                    {modeConfig[selectedMode].label}に変更
                  </div>
                  <p className="text-slate-600">{modeConfig[selectedMode].details}</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>変更する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
