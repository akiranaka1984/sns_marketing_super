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
        <h1 className="text-3xl font-bold text-[#1A1A1A]">AIコンテンツリライト</h1>
        <p className="text-[#6B6B6B] font-bold">
          既存のコンテンツをエージェントのペルソナに合わせてリライトします
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Input Section */}
        <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
          <CardHeader>
            <CardTitle className="font-bold text-[#1A1A1A]">元のコンテンツ</CardTitle>
            <CardDescription className="font-bold text-[#6B6B6B]">リライトしたいコンテンツを入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent" className="font-bold text-[#1A1A1A]">エージェント選択</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] font-bold">
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
              <Label htmlFor="content" className="font-bold text-[#1A1A1A]">コンテンツ</Label>
              <Textarea
                id="content"
                placeholder="リライトしたいコンテンツを入力..."
                value={originalContent}
                onChange={(e) => setOriginalContent(e.target.value)}
                rows={10}
                className="border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] font-bold"
              />
            </div>
            <Button
              onClick={handleRewrite}
              disabled={rewriteContent.isPending}
              className="w-full bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] font-bold"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {rewriteContent.isPending ? "リライト中..." : "リライト"}
            </Button>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
          <CardHeader>
            <CardTitle className="font-bold text-[#1A1A1A]">リライト結果</CardTitle>
            <CardDescription className="font-bold text-[#6B6B6B]">AIがリライトしたコンテンツ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rewrittenContent ? (
              <>
                <div className="space-y-2">
                  <Label className="font-bold text-[#1A1A1A]">リライト済みコンテンツ</Label>
                  <Textarea
                    value={rewrittenContent}
                    readOnly
                    rows={10}
                    className="bg-white border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] font-bold"
                  />
                </div>
                <Button onClick={handleCopy} className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] font-bold">
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
              <div className="flex items-center justify-center h-64 text-[#6B6B6B] font-bold">
                <p>リライト結果がここに表示されます</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rewrite History */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-[#1A1A1A]">リライト履歴</h2>
        <div className="grid gap-4">
          {rewrites?.map((rewrite) => (
            <Card key={rewrite.id} className="border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] bg-[#FFFDF7]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="font-bold text-[#1A1A1A]">リライト #{rewrite.id}</span>
                  <Badge variant={rewrite.status === "completed" ? "default" : "secondary"}>
                    {rewrite.status === "completed" && "完了"}
                    {rewrite.status === "pending" && "処理中"}
                    {rewrite.status === "failed" && "失敗"}
                  </Badge>
                </CardTitle>
                <CardDescription className="font-bold text-[#6B6B6B]">
                  {new Date(rewrite.createdAt).toLocaleString("ja-JP")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="font-bold text-sm mb-2 text-[#1A1A1A]">元のコンテンツ:</p>
                    <p className="text-sm text-[#6B6B6B] bg-white p-3 rounded-lg border-2 border-[#1A1A1A] font-bold">
                      {rewrite.originalContent}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-2 text-[#1A1A1A]">リライト結果:</p>
                    <p className="text-sm text-[#6B6B6B] bg-white p-3 rounded-lg border-2 border-[#1A1A1A] font-bold">
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
