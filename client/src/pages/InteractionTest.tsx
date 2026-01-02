import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function InteractionTest() {
  const [projectId, setProjectId] = useState(1);
  const [postUrlId, setPostUrlId] = useState(4);
  const [accountId, setAccountId] = useState(270002);
  const [deviceId, setDeviceId] = useState("s0t85");
  const [username, setUsername] = useState("arnold@bkkeyforceservices.ph");
  const [testingVision, setTestingVision] = useState(false);

  const fetchLatestPostsMutation = trpc.interactions.fetchLatestPosts.useMutation();
  const executeLikeMutation = trpc.interactions.executeLike.useMutation();
  const executeCommentMutation = trpc.interactions.executeComment.useMutation();

  // Test X API URL fetch
  const testUrlFetch = async () => {
    try {
      const result = await fetchLatestPostsMutation.mutateAsync({
        projectId,
        accountId,
        deviceId,
        username,
        count: 5,
      });
      if (result.success) {
        toast.success(`✅ 投稿URL取得成功: ${result.added}件の新しい投稿を追加しました（全${result.total}件）`);
      } else {
        toast.error(`❌ 投稿URL取得失敗: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`❌ 投稿URL取得失敗: ${error.message}`);
    }
  };

  // Test GPT-4 Vision coordinate detection
  const testVision = async () => {
    setTestingVision(true);
    try {
      toast.info("GPT-4 Vision座標検出は、いいね実行時に自動的に呼び出されます。\n\n直接テストする場合は、like-service.tsとvision-service.tsを確認してください。");
    } catch (error: any) {
      toast.error(`❌ Vision API失敗: ${error.message}`);
    } finally {
      setTestingVision(false);
    }
  };

  // Test like execution
  const testLike = async () => {
    try {
      const result = await executeLikeMutation.mutateAsync({
        postUrlId,
        fromAccountId: accountId,
        fromDeviceId: deviceId,
      });

      if (result.success) {
        toast.success("✅ いいね実行成功");
      } else {
        toast.error(`❌ いいね実行失敗: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`❌ いいね実行失敗: ${error.message}`);
    }
  };

  // Test comment execution
  const testComment = async () => {
    try {
      const result = await executeCommentMutation.mutateAsync({
        postUrlId,
        fromAccountId: accountId,
        fromDeviceId: deviceId,
        persona: "フレンドリーなテックユーザー",
      });

      if (result.success) {
        toast.success(`✅ コメント実行成功: ${result.comment}`);
      } else {
        toast.error(`❌ コメント実行失敗: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`❌ コメント実行失敗: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">相互連携機能テスト</h1>
        <p className="text-muted-foreground mt-2">
          API投稿URL取得、GPT-4 Vision座標検出、いいね実行、コメント実行の動作確認
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Test Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>テストパラメータ</CardTitle>
            <CardDescription>テストに使用するパラメータを設定してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="projectId">プロジェクトID</Label>
              <Input
                id="projectId"
                type="number"
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="postUrlId">投稿URL ID</Label>
              <Input
                id="postUrlId"
                type="number"
                value={postUrlId}
                onChange={(e) => setPostUrlId(Number(e.target.value))}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="accountId">アカウントID</Label>
              <Input
                id="accountId"
                type="number"
                value={accountId}
                onChange={(e) => setAccountId(Number(e.target.value))}
                placeholder="270002"
              />
            </div>
            <div>
              <Label htmlFor="deviceId">デバイスID</Label>
              <Input
                id="deviceId"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="s0t85"
              />
            </div>
            <div>
              <Label htmlFor="username">ユーザー名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="arnold@bkkeyforceservices.ph"
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle>実装状況</CardTitle>
            <CardDescription>各機能の実装ファイルが確認されています</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>x-api-service.ts - X API投稿URL取得</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>vision-service.ts - GPT-4 Vision座標検出</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>like-service.ts - DuoPlusいいね実行</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>comment-service.ts - DuoPlusコメント実行</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>ai-comment-service.ts - AIコメント生成</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>interactions テーブル - データベーススキーマ</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Buttons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. 投稿URL取得</CardTitle>
            <CardDescription>X APIで最新投稿を取得</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testUrlFetch}
              disabled={fetchLatestPostsMutation.isPending}
              className="w-full"
            >
              {fetchLatestPostsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              テスト実行
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Vision座標検出</CardTitle>
            <CardDescription>GPT-4でボタン位置を検出</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testVision}
              disabled={testingVision}
              className="w-full"
            >
              {testingVision && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              テスト実行
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. いいね実行</CardTitle>
            <CardDescription>DuoPlusでいいねをタップ</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testLike}
              disabled={executeLikeMutation.isPending}
              className="w-full"
            >
              {executeLikeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              テスト実行
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. コメント実行</CardTitle>
            <CardDescription>DuoPlusでコメントを投稿</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testComment}
              disabled={executeCommentMutation.isPending}
              className="w-full"
            >
              {executeCommentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              テスト実行
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>使用方法</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">事前準備:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Settings ページで X API Bearer Token を設定</li>
              <li>Settings ページで OpenAI API Key を設定</li>
              <li>デバイスが起動していることを確認</li>
              <li>テストするアカウントがログイン済みであることを確認</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">テスト手順:</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>上記のパラメータを入力（デフォルト値でも可）</li>
              <li>各カードの「テスト実行」ボタンをクリック</li>
              <li>トースト通知で結果を確認</li>
              <li>エラーが発生した場合は、ブラウザコンソールでログを確認</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold mb-2">注意事項:</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>GPT-4 Vision と AI コメント生成には OpenAI API Key が必要です</li>
              <li>いいね・コメント実行には DuoPlus デバイスが起動している必要があります</li>
              <li>テストは実際のSNSアカウントに影響を与えます（削除可能）</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
