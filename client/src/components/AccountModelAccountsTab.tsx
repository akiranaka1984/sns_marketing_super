import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users2, Plus, Trash2, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AccountModelAccountsTabProps {
  accountId: number;
}

export default function AccountModelAccountsTab({ accountId }: AccountModelAccountsTabProps) {
  const utils = trpc.useUtils();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedModelAccountId, setSelectedModelAccountId] = useState<string>("");

  const { data: linkedAccounts, isLoading } = trpc.accounts.linkedModelAccounts.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const { data: allModelAccounts } = trpc.modelAccounts.list.useQuery({});

  const linkMutation = trpc.accounts.linkModelAccount.useMutation({
    onSuccess: () => {
      toast.success("モデルアカウントを連携しました");
      setIsLinkDialogOpen(false);
      setSelectedModelAccountId("");
      utils.accounts.linkedModelAccounts.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`連携失敗: ${error.message}`);
    },
  });

  const unlinkMutation = trpc.accounts.unlinkModelAccount.useMutation({
    onSuccess: () => {
      toast.success("連携を解除しました");
      utils.accounts.linkedModelAccounts.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`解除失敗: ${error.message}`);
    },
  });

  const updateLinkMutation = trpc.accounts.updateModelAccountLink.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      utils.accounts.linkedModelAccounts.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const handleLink = () => {
    if (!selectedModelAccountId) {
      toast.error("モデルアカウントを選択してください");
      return;
    }
    linkMutation.mutate({
      accountId,
      modelAccountId: parseInt(selectedModelAccountId),
      autoApplyLearnings: false,
    });
  };

  const handleUnlink = (modelAccountId: number) => {
    unlinkMutation.mutate({ accountId, modelAccountId });
  };

  const handleToggleAutoApply = (modelAccountId: number, currentValue: boolean) => {
    updateLinkMutation.mutate({
      accountId,
      modelAccountId,
      autoApplyLearnings: !currentValue,
    });
  };

  // Filter out already linked accounts
  const linkedIds = linkedAccounts?.map(l => l.modelAccount.id) || [];
  const availableModelAccounts = allModelAccounts?.filter(ma => !linkedIds.includes(ma.id)) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              モデルアカウント連携
            </CardTitle>
            <CardDescription>
              成功しているアカウントからの学習データを取り込みます
            </CardDescription>
          </div>
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={availableModelAccounts.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                連携追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>モデルアカウントを連携</DialogTitle>
                <DialogDescription>
                  学習元となるモデルアカウントを選択してください
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="model-account-select">モデルアカウント</Label>
                <Select value={selectedModelAccountId} onValueChange={setSelectedModelAccountId}>
                  <SelectTrigger id="model-account-select" className="mt-2">
                    <SelectValue placeholder="アカウントを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModelAccounts.map((ma) => (
                      <SelectItem key={ma.id} value={ma.id.toString()}>
                        @{ma.username} ({ma.platform})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsLinkDialogOpen(false)}
                  disabled={linkMutation.isPending}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleLink}
                  disabled={linkMutation.isPending || !selectedModelAccountId}
                >
                  {linkMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      連携中...
                    </>
                  ) : (
                    "連携"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {linkedAccounts && linkedAccounts.length > 0 ? (
          <div className="space-y-3">
            {linkedAccounts.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {link.modelAccount.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">@{link.modelAccount.username}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {link.modelAccount.platform}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {link.modelAccount.displayName || link.modelAccount.bio?.slice(0, 50)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`auto-apply-${link.id}`} className="text-sm text-slate-600">
                      自動適用
                    </Label>
                    <Switch
                      id={`auto-apply-${link.id}`}
                      checked={Boolean(Number(link.autoApplyLearnings))}
                      onCheckedChange={() =>
                        handleToggleAutoApply(link.modelAccount.id, Boolean(Number(link.autoApplyLearnings)))
                      }
                      disabled={updateLinkMutation.isPending}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleUnlink(link.modelAccount.id)}
                    disabled={unlinkMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">連携されたモデルアカウントがありません</p>
            <p className="text-sm text-slate-400">
              モデルアカウントを連携すると、成功パターンや投稿スタイルを学習できます
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
