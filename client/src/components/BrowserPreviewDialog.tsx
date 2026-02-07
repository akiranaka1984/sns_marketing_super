import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBrowserPreview } from "@/hooks/useBrowserPreview";
import { Monitor, Loader2, Wifi, WifiOff } from "lucide-react";

const STEP_LABELS: Record<string, string> = {
  // Login steps
  navigating_to_login: "ログインページへ移動中...",
  entering_username: "ユーザー名を入力中...",
  entering_password: "パスワードを入力中...",
  waiting_for_redirect: "リダイレクト待機中...",
  // Post steps
  navigating_to_home: "ホームへ移動中...",
  opening_compose: "投稿画面を開いています...",
  entering_content: "投稿内容を入力中...",
  uploading_media: "メディアをアップロード中...",
  submitting_post: "投稿を送信中...",
  // Health check steps
  checking_login_status: "ログイン状態を確認中...",
  // Test preview steps
  connecting: "WebSocket接続待機中...",
  loading_page: "ページを読み込み中...",
  previewing: "プレビュー表示中...",
  done: "完了",
};

const OPERATION_LABELS: Record<string, string> = {
  login: "ログイン",
  post: "投稿",
  health_check: "ヘルスチェック",
  test: "テストプレビュー",
};

interface BrowserPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  username?: string;
}

export default function BrowserPreviewDialog({
  open,
  onOpenChange,
  accountId,
  username,
}: BrowserPreviewDialogProps) {
  const { imageUrl, status, operationStep, operationType } = useBrowserPreview(
    accountId,
    open
  );

  const stepLabel = operationStep ? STEP_LABELS[operationStep] || operationStep : null;
  const operationLabel = operationType ? OPERATION_LABELS[operationType] || operationType : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-[#E5E5E5]">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
              <Monitor className="w-4 h-4" />
              ブラウザプレビュー
              {username && (
                <span className="text-[#737373] font-normal">- @{username}</span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {status === "streaming" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              ) : status === "connecting" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  接続中
                </span>
              ) : status === "idle" ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F5F5] text-[#737373] border border-[#E5E5E5]">
                  <Wifi className="w-3 h-3" />
                  待機中
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  <WifiOff className="w-3 h-3" />
                  切断
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Preview area */}
        <div className="relative bg-[#0A0A0A]" style={{ aspectRatio: "16/10" }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Browser preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {status === "disconnected" ? (
                <>
                  <WifiOff className="w-12 h-12 text-[#525252]" />
                  <p className="text-sm font-medium text-[#737373]">
                    プレビュー接続が切断されました
                  </p>
                </>
              ) : status === "streaming" ? (
                <>
                  <div className="relative">
                    <Monitor className="w-12 h-12 text-[#525252]" />
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin absolute -bottom-1 -right-1" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#737373]">
                      フレームを受信中...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <Monitor className="w-12 h-12 text-[#525252]" />
                    {status === "connecting" && (
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#737373]">
                      {status === "connecting"
                        ? "接続中..."
                        : "操作を開始するとブラウザ画面が表示されます"}
                    </p>
                    <p className="text-xs text-[#525252] mt-1">
                      ログインやヘルスチェックを実行してください
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Operation status bar */}
        {(operationLabel || stepLabel) && (
          <div className="px-5 py-2.5 border-t border-[#E5E5E5] bg-[#FAFAFA]">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-[#D4380D] animate-spin flex-shrink-0" />
              <span className="text-xs font-medium text-[#525252]">
                {operationLabel && (
                  <span className="text-[#1A1A1A] font-semibold mr-1.5">
                    [{operationLabel}]
                  </span>
                )}
                {stepLabel || "処理中..."}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
