/**
 * AccountAgentsTab
 * Allows managing agent linkages from the account detail page
 */

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, Link2, Unlink, Plus, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface AccountAgentsTabProps {
  accountId: number;
}

export default function AccountAgentsTab({ accountId }: AccountAgentsTabProps) {
  const utils = trpc.useUtils();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Fetch linked agents
  const { data: linkedAgents, isLoading: isLoadingLinked } = trpc.accounts.getLinkedAgents.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  // Fetch available agents to link
  const { data: availableAgents, isLoading: isLoadingAvailable } = trpc.accounts.getAvailableAgents.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  // Link agent mutation
  const linkMutation = trpc.agents.linkAccount.useMutation({
    onSuccess: () => {
      toast.success("エージェントをリンクしました");
      setSelectedAgentId("");
      utils.accounts.getLinkedAgents.invalidate({ accountId });
      utils.accounts.getAvailableAgents.invalidate({ accountId });
    },
    onError: (error: any) => {
      toast.error(`リンク失敗: ${error.message}`);
    },
  });

  // Unlink agent mutation
  const unlinkMutation = trpc.agents.unlinkAccount.useMutation({
    onSuccess: () => {
      toast.success("エージェントのリンクを解除しました");
      utils.accounts.getLinkedAgents.invalidate({ accountId });
      utils.accounts.getAvailableAgents.invalidate({ accountId });
    },
    onError: (error: any) => {
      toast.error(`リンク解除失敗: ${error.message}`);
    },
  });

  const handleLink = () => {
    if (!selectedAgentId) {
      toast.error("エージェントを選択してください");
      return;
    }
    linkMutation.mutate({
      agentId: parseInt(selectedAgentId),
      accountId,
    });
  };

  const handleUnlink = (agentId: number) => {
    if (confirm("このエージェントからアカウントのリンクを解除しますか？")) {
      unlinkMutation.mutate({
        agentId,
        accountId,
      });
    }
  };

  const activeLinkedAgents = linkedAgents?.filter((la: any) => la.isActive === 1) || [];
  const inactiveLinkedAgents = linkedAgents?.filter((la: any) => la.isActive !== 1) || [];

  return (
    <div className="space-y-6">
      {/* Link New Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-500" />
            エージェントをリンク
          </CardTitle>
          <CardDescription>
            このアカウントを使用するエージェントを追加します。リンクされたエージェントはこのアカウントで投稿を行います。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="エージェントを選択..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingAvailable ? (
                  <div className="p-2 text-center text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : availableAgents && availableAgents.length > 0 ? (
                  availableAgents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-violet-500" />
                        <span>{agent.name}</span>
                        <span className="text-xs text-slate-400">({agent.theme?.substring(0, 20)}...)</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-sm text-slate-500">
                    リンク可能なエージェントがありません
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleLink}
              disabled={!selectedAgentId || linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              リンク
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Linked Agents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            リンク中のエージェント
          </CardTitle>
          <CardDescription>
            このアカウントにリンクされているエージェント一覧です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLinked ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : activeLinkedAgents.length > 0 ? (
            <div className="space-y-3">
              {activeLinkedAgents.map((link: any) => (
                <div
                  key={link.agentAccountId}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 rounded-full">
                      <Bot className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <Link href={`/agents/${link.agentId}`}>
                        <span className="font-medium text-slate-900 hover:text-violet-600 cursor-pointer">
                          {link.agentName || `エージェント #${link.agentId}`}
                        </span>
                      </Link>
                      <p className="text-sm text-slate-500">
                        {link.agentTheme?.substring(0, 50)}
                        {link.agentTheme && link.agentTheme.length > 50 ? "..." : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      アクティブ
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlink(link.agentId)}
                      disabled={unlinkMutation.isPending}
                    >
                      {unlinkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">リンクされているエージェントがありません</p>
              <p className="text-sm text-slate-400 mt-1">
                上のフォームからエージェントをリンクしてください
              </p>
            </div>
          )}

          {/* Inactive Links */}
          {inactiveLinkedAgents.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium text-slate-600 mb-3">非アクティブなリンク</h4>
              <div className="space-y-2">
                {inactiveLinkedAgents.map((link: any) => (
                  <div
                    key={link.agentAccountId}
                    className="flex items-center justify-between p-3 bg-slate-100 rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        {link.agentName || `エージェント #${link.agentId}`}
                      </span>
                    </div>
                    <Badge variant="secondary" className="bg-slate-200 text-slate-500">
                      非アクティブ
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Bot className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">エージェントとアカウントの関係について</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>1つのアカウントは複数のエージェントにリンクできます</li>
                <li>エージェントがこのアカウントで投稿を行う際、アカウントのペルソナ設定が反映されます</li>
                <li>リンクを解除してもエージェント自体は削除されません</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
