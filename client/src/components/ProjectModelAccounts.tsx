import { useState } from "react";
import { Users2, Link2, Unlink, Settings, Zap, Loader2, RefreshCw, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

interface ProjectModelAccountsProps {
  projectId: number;
  projectAccounts?: { accountId: number; account?: { id: number; username: string } }[];
}

const INDUSTRY_CATEGORY_LABELS: Record<string, string> = {
  it_tech: "IT・テック",
  beauty_fashion: "美容・ファッション",
  food_restaurant: "グルメ・飲食",
  finance_investment: "金融・投資",
  health_fitness: "健康・フィットネス",
  education: "教育",
  entertainment: "エンタメ",
  travel: "旅行",
  business: "ビジネス",
  other: "その他",
};

export default function ProjectModelAccounts({ projectId, projectAccounts = [] }: ProjectModelAccountsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<any | null>(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState<number | null>(null);
  const [selectedModelAccountId, setSelectedModelAccountId] = useState<string>("");
  const [autoApply, setAutoApply] = useState(false);
  const [targetAccountIds, setTargetAccountIds] = useState<number[]>([]);

  // Fetch linked model accounts
  const { data: linkedAccounts, isLoading, refetch } =
    trpc.projectModelAccounts.list.useQuery({ projectId });

  // Fetch available model accounts (not yet linked)
  const { data: availableAccounts } =
    trpc.projectModelAccounts.getAvailableModelAccounts.useQuery({ projectId });

  // Fetch applied learnings
  const { data: appliedLearnings } =
    trpc.projectModelAccounts.getAppliedLearnings.useQuery({ projectId, limit: 20 });

  // Mutations
  const linkMutation = trpc.projectModelAccounts.link.useMutation({
    onSuccess: () => {
      toast.success("モデルアカウントを紐付けました");
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "紐付けに失敗しました");
    },
  });

  const unlinkMutation = trpc.projectModelAccounts.unlink.useMutation({
    onSuccess: () => {
      toast.success("紐付けを解除しました");
      refetch();
      setUnlinkConfirm(null);
    },
    onError: () => {
      toast.error("紐付け解除に失敗しました");
    },
  });

  const updateSettingsMutation = trpc.projectModelAccounts.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      refetch();
      setIsSettingsDialogOpen(false);
    },
    onError: () => {
      toast.error("設定の更新に失敗しました");
    },
  });

  const applyLearningsMutation = trpc.projectModelAccounts.applyLearnings.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.applied}件の学習を${result.targetAccountsCount}アカウントに適用しました`);
      refetch();
    },
    onError: () => {
      toast.error("学習の適用に失敗しました");
    },
  });

  const resetForm = () => {
    setSelectedModelAccountId("");
    setAutoApply(false);
    setTargetAccountIds([]);
  };

  const handleLink = () => {
    if (!selectedModelAccountId) {
      toast.error("モデルアカウントを選択してください");
      return;
    }

    linkMutation.mutate({
      projectId,
      modelAccountId: parseInt(selectedModelAccountId),
      autoApplyLearnings: autoApply,
      targetAccountIds: targetAccountIds.length > 0 ? targetAccountIds : undefined,
    });
  };

  const handleOpenSettings = (link: any) => {
    setSelectedLink(link);
    setAutoApply(Boolean(Number(link.autoApplyLearnings)));
    try {
      const targets = link.targetAccountIds ? JSON.parse(link.targetAccountIds) : [];
      setTargetAccountIds(targets);
    } catch {
      setTargetAccountIds([]);
    }
    setIsSettingsDialogOpen(true);
  };

  const handleUpdateSettings = () => {
    if (!selectedLink) return;

    updateSettingsMutation.mutate({
      linkId: selectedLink.id,
      autoApplyLearnings: autoApply,
      targetAccountIds: targetAccountIds.length > 0 ? targetAccountIds : null,
    });
  };

  const handleApplyLearnings = (linkId: number) => {
    applyLearningsMutation.mutate({ linkId });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users2 className="h-5 w-5 text-purple-500" />
                モデルアカウント連携
              </CardTitle>
              <CardDescription>
                インフルエンサーの投稿パターンを分析し、プロジェクトアカウントに適用します
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                更新
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAddDialogOpen(true)}
                disabled={!availableAccounts || availableAccounts.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Linked Model Accounts List */}
          {linkedAccounts && linkedAccounts.length > 0 ? (
            <div className="space-y-3">
              {linkedAccounts.map((item: any) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                        {item.modelAccount?.username?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">@{item.modelAccount?.username}</span>
                          {item.modelAccount?.displayName && (
                            <span className="text-slate-500 text-sm">{item.modelAccount.displayName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {item.modelAccount?.industryCategory && (
                            <Badge variant="outline" className="text-xs">
                              {INDUSTRY_CATEGORY_LABELS[item.modelAccount.industryCategory] || item.modelAccount.industryCategory}
                            </Badge>
                          )}
                          {item.modelAccount?.followersCount > 0 && (
                            <span className="text-xs text-slate-500">
                              {item.modelAccount.followersCount.toLocaleString()} フォロワー
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                            学習: {item.learningsCount || 0}件
                          </span>
                          <span className="flex items-center gap-1">
                            {Boolean(Number(item.autoApplyLearnings)) ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                自動適用: ON
                              </>
                            ) : (
                              <>
                                <span className="h-3 w-3 rounded-full border border-slate-300" />
                                自動適用: OFF
                              </>
                            )}
                          </span>
                          {item.lastSyncedAt && (
                            <span className="text-slate-500">
                              最終同期: {new Date(item.lastSyncedAt).toLocaleString('ja-JP')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApplyLearnings(item.id)}
                        disabled={applyLearningsMutation.isPending}
                      >
                        {applyLearningsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 text-yellow-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenSettings(item)}
                      >
                        <Settings className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUnlinkConfirm(item.id)}
                      >
                        <Unlink className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Link2 className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p>モデルアカウントが紐付けられていません</p>
              <p className="text-sm">「追加」ボタンでモデルアカウントを紐付けてください</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Applied Learnings Section */}
      {appliedLearnings && appliedLearnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              適用可能な学習 ({appliedLearnings.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {appliedLearnings.map((learning: any) => (
                <div
                  key={learning.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {learning.learningType}
                      </Badge>
                      <span className="font-medium text-sm">{learning.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {learning.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      信頼度: {learning.confidence}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Model Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>モデルアカウントを紐付け</DialogTitle>
            <DialogDescription>
              プロジェクトに紐付けるモデルアカウントを選択してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Model Account Selection */}
            <div className="space-y-2">
              <Label>モデルアカウント</Label>
              <Select value={selectedModelAccountId} onValueChange={setSelectedModelAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts?.map((account: any) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      @{account.username}
                      {account.displayName && ` (${account.displayName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!availableAccounts || availableAccounts.length === 0) && (
                <p className="text-xs text-slate-500">
                  紐付け可能なモデルアカウントがありません。
                  先にモデルアカウントを追加してください。
                </p>
              )}
            </div>

            {/* Auto Apply Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>自動適用</Label>
                <p className="text-xs text-slate-500">
                  新しい学習を自動的にプロジェクトアカウントに適用
                </p>
              </div>
              <Switch checked={autoApply} onCheckedChange={setAutoApply} />
            </div>

            {/* Target Accounts Selection (Optional) */}
            <div className="space-y-2">
              <Label>対象アカウント（任意）</Label>
              <p className="text-xs text-slate-500 mb-2">
                指定しない場合、すべてのプロジェクトアカウントに適用されます
              </p>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {projectAccounts.map((pa: any) => (
                  <div key={pa.accountId} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`target-${pa.accountId}`}
                      checked={targetAccountIds.includes(pa.accountId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTargetAccountIds([...targetAccountIds, pa.accountId]);
                        } else {
                          setTargetAccountIds(targetAccountIds.filter(id => id !== pa.accountId));
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                    <label htmlFor={`target-${pa.accountId}`} className="text-sm cursor-pointer">
                      @{pa.account?.username || `Account ${pa.accountId}`}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              resetForm();
            }}>
              キャンセル
            </Button>
            <Button
              onClick={handleLink}
              disabled={linkMutation.isPending || !selectedModelAccountId}
            >
              {linkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              紐付け
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>連携設定</DialogTitle>
            <DialogDescription>
              {selectedLink?.modelAccount && (
                <>@{selectedLink.modelAccount.username} の連携設定</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Auto Apply Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>自動適用</Label>
                <p className="text-xs text-slate-500">
                  新しい学習を自動的にプロジェクトアカウントに適用
                </p>
              </div>
              <Switch checked={autoApply} onCheckedChange={setAutoApply} />
            </div>

            {/* Target Accounts Selection */}
            <div className="space-y-2">
              <Label>対象アカウント</Label>
              <p className="text-xs text-slate-500 mb-2">
                指定しない場合、すべてのプロジェクトアカウントに適用されます
              </p>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {projectAccounts.map((pa: any) => (
                  <div key={pa.accountId} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`settings-target-${pa.accountId}`}
                      checked={targetAccountIds.includes(pa.accountId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTargetAccountIds([...targetAccountIds, pa.accountId]);
                        } else {
                          setTargetAccountIds(targetAccountIds.filter(id => id !== pa.accountId));
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                    <label htmlFor={`settings-target-${pa.accountId}`} className="text-sm cursor-pointer">
                      @{pa.account?.username || `Account ${pa.accountId}`}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleUpdateSettings}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={unlinkConfirm !== null} onOpenChange={() => setUnlinkConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>紐付けを解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このモデルアカウントとの紐付けを解除します。
              既に適用された学習は削除されません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkConfirm && unlinkMutation.mutate({ linkId: unlinkConfirm })}
              className="bg-red-600 hover:bg-red-700"
            >
              解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
