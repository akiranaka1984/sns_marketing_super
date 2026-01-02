import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wand2, Copy, Check } from "lucide-react";

export default function ContentRewrite() {
  const [originalContent, setOriginalContent] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [rewrittenContent, setRewrittenContent] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: agents } = trpc.agents.list.useQuery();
  const { data: rewrites, refetch: refetchRewrites } = trpc.contentRewrite.listRewrites.useQuery({ limit: 20 });

  const rewriteContent = trpc.contentRewrite.rewriteContent.useMutation({
    onSuccess: (data) => {
      toast.success("コンテンツをリライトしました");
      setRewrittenContent(data.rewrittenContent);
      refetchRewrites();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleRewrite = () => {
    if (!originalContent.trim()) {
      toast.error("リライトするコンテンツを入力してください");
      return;
    }
    if (!selectedAgentId) {
      toast.error("エージェントを選択してください");
      return;
    }

    rewriteContent.mutate({
      originalContent,
      agentId: parseInt(selectedAgentId),
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rewrittenContent);
    setCopied(true);
    toast.success("コピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AIコンテンツリライト</h1>
        <p className="text-muted-foreground">
          既存のコンテンツをエージェントのペルソナに合わせてリライトします
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>元のコンテンツ</CardTitle>
            <CardDescription>リライトしたいコンテンツを入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent">エージェント選択</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="エージェントを選択" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name} ({agent.tone} / {agent.style})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">コンテンツ</Label>
              <Textarea
                id="content"
                placeholder="リライトしたいコンテンツを入力..."
                value={originalContent}
                onChange={(e) => setOriginalContent(e.target.value)}
                rows={10}
              />
            </div>
            <Button
              onClick={handleRewrite}
              disabled={rewriteContent.isPending}
              className="w-full"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {rewriteContent.isPending ? "リライト中..." : "リライト"}
            </Button>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle>リライト結果</CardTitle>
            <CardDescription>AIがリライトしたコンテンツ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rewrittenContent ? (
              <>
                <div className="space-y-2">
                  <Label>リライト済みコンテンツ</Label>
                  <Textarea
                    value={rewrittenContent}
                    readOnly
                    rows={10}
                    className="bg-muted"
                  />
                </div>
                <Button onClick={handleCopy} variant="outline" className="w-full">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      コピー
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>リライト結果がここに表示されます</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rewrite History */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">リライト履歴</h2>
        <div className="grid gap-4">
          {rewrites?.map((rewrite) => (
            <Card key={rewrite.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>リライト #{rewrite.id}</span>
                  <Badge variant={rewrite.status === "completed" ? "default" : "secondary"}>
                    {rewrite.status === "completed" && "完了"}
                    {rewrite.status === "pending" && "処理中"}
                    {rewrite.status === "failed" && "失敗"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {new Date(rewrite.createdAt).toLocaleString("ja-JP")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-medium text-sm mb-2">元のコンテンツ:</p>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {rewrite.originalContent}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-sm mb-2">リライト結果:</p>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {rewrite.rewrittenContent || "処理中..."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
