import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Calendar, Activity, Loader2, Info,
  Edit2, Save, X, RefreshCw, User, BookOpen, Users2, LayoutDashboard, Sparkles, Bot,
  Monitor, Shield, ShieldCheck, ShieldAlert, ShieldX, LogIn, Trash2, Eye
} from "lucide-react";
import { useState, useEffect } from "react";
import BrowserPreviewDialog from "@/components/BrowserPreviewDialog";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import AccountLevelCard from "@/components/AccountLevelCard";
import AccountLearningsTab from "@/components/AccountLearningsTab";
import AccountPersonaTab from "@/components/AccountPersonaTab";
import AccountModelAccountsTab from "@/components/AccountModelAccountsTab";
import AccountProfileTab from "@/components/AccountProfileTab";
import AccountAgentsTab from "@/components/AccountAgentsTab";

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; border: string; icon: typeof ShieldCheck; label: string }> = {
    active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: ShieldCheck, label: "Active" },
    expired: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: ShieldAlert, label: "Expired" },
    needs_login: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: ShieldX, label: "Needs Login" },
  };
  const { bg, text, border, icon: Icon, label } = config[status] || config.needs_login;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${bg} ${text} border ${border}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export default function AccountDetail() {
  const { t } = useI18n();
  const [, params] = useRoute("/accounts/:id");
  const accountId = params?.id ? parseInt(params.id) : 0;
  const [isEditingXHandle, setIsEditingXHandle] = useState(false);
  const [xHandleInput, setXHandleInput] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [previewOpen, setPreviewOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: account, isLoading } = trpc.accounts.byId.useQuery(
    { id: accountId },
    { refetchInterval: 60000 }
  );

  const { data: growthStats, isLoading: isLoadingGrowth } = trpc.accounts.growthStats.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  // Playwright session hooks
  const { data: sessionStatus, refetch: refetchSession } = trpc.playwrightSession.getStatus.useQuery(
    { accountId },
    { enabled: !!accountId, refetchInterval: 30000 }
  );

  const loginMutation = trpc.playwrightSession.login.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("X.comログイン成功");
      } else {
        toast.error(result.message);
      }
      refetchSession();
      utils.accounts.byId.invalidate({ id: accountId });
      // Auto-close preview after 2 seconds
      setTimeout(() => setPreviewOpen(false), 2000);
    },
    onError: (error) => {
      toast.error(`ログイン失敗: ${error.message}`);
      setTimeout(() => setPreviewOpen(false), 2000);
    },
  });

  const healthCheckMutation = trpc.playwrightSession.checkHealth.useMutation({
    onSuccess: (result) => {
      if (result.healthy) {
        toast.success("セッションは有効です");
      } else {
        toast.warning(`セッション状態: ${result.status}`);
      }
      refetchSession();
      setTimeout(() => setPreviewOpen(false), 2000);
    },
    onError: (error) => {
      toast.error(`ヘルスチェック失敗: ${error.message}`);
      setTimeout(() => setPreviewOpen(false), 2000);
    },
  });

  const testPreviewMutation = trpc.playwrightSession.testPreview.useMutation({
    onSuccess: () => {
      toast.success("テストプレビュー完了");
      // Don't auto-close — let the user close the modal manually
    },
    onError: (error) => {
      toast.error(`テストプレビュー失敗: ${error.message}`);
    },
  });

  const deleteSessionMutation = trpc.playwrightSession.deleteSession.useMutation({
    onSuccess: () => {
      toast.success("セッションを削除しました");
      refetchSession();
    },
    onError: (error) => {
      toast.error(`セッション削除失敗: ${error.message}`);
    },
  });

  const updateAccountMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      toast.success("X Handleを更新しました");
      setIsEditingXHandle(false);
      utils.accounts.byId.invalidate({ id: accountId });
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const syncGrowthMutation = trpc.accounts.syncGrowth.useMutation({
    onSuccess: (result) => {
      toast.success(`成長データを同期しました: ${result.learningsCount}件の学習、${result.totalXP} XP`);
      utils.accounts.growthStats.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`同期失敗: ${error.message}`);
    },
  });

  const handleEditXHandle = () => {
    setXHandleInput((account as any)?.xHandle || "");
    setIsEditingXHandle(true);
  };

  const handleSaveXHandle = () => {
    updateAccountMutation.mutate({
      accountId,
      xHandle: xHandleInput.trim(),
    });
  };

  const handleCancelEdit = () => {
    setIsEditingXHandle(false);
    setXHandleInput("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4380D]" />
          <span className="text-sm text-[#A3A3A3]">Loading account...</span>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-5xl">
        <div className="signal-card p-8 text-center">
          <p className="text-[#A3A3A3] mb-4">Account not found</p>
          <Button asChild size="sm" className="bg-[#D4380D] hover:bg-[#B8300B] text-white">
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('accountDetail.backToAccounts')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentSessionStatus = sessionStatus?.sessionStatus || (account as any).sessionStatus || 'needs_login';

  return (
    <div className="max-w-5xl space-y-5">
      {/* Back + Header */}
      <div className="fade-in-up">
        <Link href="/accounts">
          <button className="flex items-center gap-1.5 text-xs font-medium text-[#A3A3A3] hover:text-[#1A1A1A] transition-colors mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Accounts
          </button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <p className="section-label mb-1">Account Detail</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A1A]">
              @{account.username}
            </h1>
            <p className="text-sm text-[#737373] capitalize mt-0.5">
              {t('accounts.platform.' + account.platform)} Account
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Monitor className="w-3.5 h-3.5" />
              Playwright
            </span>
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
              account.status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : account.status === 'pending'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {account.status}
            </span>
          </div>
        </div>
      </div>

      {/* Level Card */}
      {growthStats && (
        <div className="fade-in-up" style={{ animationDelay: '80ms' }}>
          <AccountLevelCard
            level={growthStats.level}
            experiencePoints={growthStats.experiencePoints}
            currentLevelXP={growthStats.currentLevelXP}
            requiredXP={growthStats.requiredXP}
            progressPercent={growthStats.progressPercent}
            totalLearningsCount={growthStats.totalLearningsCount}
            learningsByType={growthStats.learningsByType}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="fade-in-up" style={{ animationDelay: '160ms' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E5E5] rounded-lg w-fit">
            {[
              { value: "overview", icon: LayoutDashboard, label: "概要" },
              { value: "session", icon: Shield, label: "セッション" },
              { value: "learnings", icon: BookOpen, label: "学習" },
              { value: "persona", icon: User, label: "ペルソナ" },
              { value: "model-accounts", icon: Users2, label: "モデル" },
              { value: "profile", icon: Sparkles, label: "プロフィール" },
              { value: "agents", icon: Bot, label: "エージェント" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === tab.value
                    ? "bg-[#1A1A1A] text-white shadow-sm"
                    : "text-[#737373] hover:text-[#1A1A1A] hover:bg-[#F5F5F5]"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="signal-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">投稿方式</p>
                    <div className="p-1.5 rounded-lg bg-[#F5F5F5]">
                      <Monitor className="h-3.5 w-3.5 text-[#A3A3A3]" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Playwright</p>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5">ブラウザ自動化</p>
                </div>

                <div className="signal-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">作成日</p>
                    <div className="p-1.5 rounded-lg bg-[#F5F5F5]">
                      <Calendar className="h-3.5 w-3.5 text-[#A3A3A3]" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {new Date(account.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5">
                    {new Date(account.createdAt).toLocaleTimeString("ja-JP")}
                  </p>
                </div>

                <div className="signal-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">成長データ</p>
                    <div className="p-1.5 rounded-lg bg-[#F5F5F5]">
                      <Activity className="h-3.5 w-3.5 text-[#A3A3A3]" />
                    </div>
                  </div>
                  <p className="text-xs text-[#737373]">
                    既存の学習データから経験値を再計算
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full h-7 text-xs border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]"
                    onClick={() => syncGrowthMutation.mutate({ accountId })}
                    disabled={syncGrowthMutation.isPending}
                  >
                    {syncGrowthMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                    )}
                    同期
                  </Button>
                </div>
              </div>

              {/* Account Details */}
              <div className="signal-card p-5">
                <p className="section-label mb-4">アカウント詳細</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">Username</label>
                    <p className="text-sm font-medium text-[#1A1A1A] mt-0.5">{account.username}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">X Handle</label>
                    {isEditingXHandle ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-[#A3A3A3]">@</span>
                        <Input
                          value={xHandleInput}
                          onChange={(e) => setXHandleInput(e.target.value)}
                          placeholder="例: elonmusk"
                          className="flex-1 h-8 text-sm border-[#E5E5E5]"
                        />
                        <button
                          onClick={handleSaveXHandle}
                          disabled={updateAccountMutation.isPending}
                          className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 transition-colors"
                        >
                          {updateAccountMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 rounded-md hover:bg-[#F5F5F5] text-[#A3A3A3] transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        {(account as any).xHandle ? (
                          <code className="text-sm font-mono bg-[#F5F5F5] text-[#525252] px-2 py-0.5 rounded">
                            @{(account as any).xHandle}
                          </code>
                        ) : (
                          <span className="text-sm text-[#A3A3A3]">未設定</span>
                        )}
                        <button onClick={handleEditXHandle} className="p-1 rounded-md hover:bg-[#F5F5F5] text-[#A3A3A3] transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">Platform</label>
                    <p className="text-sm font-medium text-[#1A1A1A] mt-0.5 capitalize">{account.platform}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">Device ID</label>
                    <p className="text-sm font-medium text-[#1A1A1A] mt-0.5 font-mono">{account.deviceId || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Session Management Tab (Playwright) */}
          {activeTab === "session" && (
            <div className="space-y-4">
              {/* Session Status */}
              <div className="signal-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="section-label">ブラウザセッション</p>
                    <SessionStatusBadge status={currentSessionStatus} />
                  </div>

                  <div className="space-y-3">
                    {/* Status detail */}
                    <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5]">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          currentSessionStatus === 'active' ? 'bg-emerald-100' :
                          currentSessionStatus === 'expired' ? 'bg-amber-100' : 'bg-red-100'
                        }`}>
                          {currentSessionStatus === 'active' ? (
                            <ShieldCheck className="w-5 h-5 text-emerald-700" />
                          ) : currentSessionStatus === 'expired' ? (
                            <ShieldAlert className="w-5 h-5 text-amber-700" />
                          ) : (
                            <ShieldX className="w-5 h-5 text-red-700" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#1A1A1A]">
                            {currentSessionStatus === 'active'
                              ? 'セッション有効'
                              : currentSessionStatus === 'expired'
                              ? 'セッション期限切れ'
                              : 'ログインが必要'}
                          </p>
                          <p className="text-xs text-[#737373] mt-0.5">
                            {currentSessionStatus === 'active'
                              ? 'X.comへの投稿が可能です。'
                              : currentSessionStatus === 'expired'
                              ? 'セッションが期限切れです。再ログインしてください。'
                              : '初回ログインを行ってセッションを確立してください。'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                        className="h-8 text-xs font-semibold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        ライブプレビュー
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewOpen(true);
                          testPreviewMutation.mutate({ accountId });
                        }}
                        disabled={testPreviewMutation.isPending}
                        className="h-8 text-xs font-semibold border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      >
                        {testPreviewMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Monitor className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        テストプレビュー
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setPreviewOpen(true);
                          loginMutation.mutate({ accountId });
                        }}
                        disabled={loginMutation.isPending}
                        className="h-8 text-xs font-semibold bg-[#D4380D] hover:bg-[#B8300B] text-white"
                      >
                        {loginMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <LogIn className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {currentSessionStatus === 'active' ? '再ログイン' : 'ログイン'}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewOpen(true);
                          healthCheckMutation.mutate({ accountId });
                        }}
                        disabled={healthCheckMutation.isPending}
                        className="h-8 text-xs font-semibold border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]"
                      >
                        {healthCheckMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        ヘルスチェック
                      </Button>

                      {currentSessionStatus !== 'needs_login' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("セッションを削除しますか？再度ログインが必要になります。")) {
                              deleteSessionMutation.mutate({ accountId });
                            }
                          }}
                          disabled={deleteSessionMutation.isPending}
                          className="h-8 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {deleteSessionMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          セッション削除
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

              {/* Info note */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5]">
                <Info className="w-4 h-4 text-[#A3A3A3] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-[#737373] leading-relaxed">
                  <p className="font-semibold text-[#525252] mb-1">セッションについて</p>
                  <p>
                    Playwrightブラウザ自動化を使用してX.comに投稿します。
                    X.comへのログインセッションの管理が必要です。
                    セッションが期限切れの場合は再ログインしてください。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Learnings Tab */}
          {activeTab === "learnings" && (
            <AccountLearningsTab accountId={accountId} />
          )}

          {/* Persona Tab */}
          {activeTab === "persona" && (
            <AccountPersonaTab
              accountId={accountId}
              account={{
                personaRole: (account as any).personaRole,
                personaTone: (account as any).personaTone,
                personaCharacteristics: (account as any).personaCharacteristics,
              }}
            />
          )}

          {/* Model Accounts Tab */}
          {activeTab === "model-accounts" && (
            <AccountModelAccountsTab accountId={accountId} />
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <AccountProfileTab
              accountId={accountId}
              account={{
                username: account.username,
                xHandle: (account as any).xHandle,
                platform: account.platform,
                personaRole: (account as any).personaRole,
                personaTone: (account as any).personaTone,
                personaCharacteristics: (account as any).personaCharacteristics,
              }}
            />
          )}

          {/* Agents Tab */}
          {activeTab === "agents" && (
            <AccountAgentsTab accountId={accountId} />
          )}
        </Tabs>
      </div>

      {/* Browser Preview Dialog */}
      <BrowserPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        accountId={accountId}
        username={account.username}
      />
    </div>
  );
}
