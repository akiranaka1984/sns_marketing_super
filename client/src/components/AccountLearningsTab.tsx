import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, TrendingUp, MessageSquare, Hash, Clock, AlertTriangle, Zap } from "lucide-react";

interface AccountLearningsTabProps {
  accountId: number;
}

const LEARNING_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; xp: number }> = {
  success_pattern: { label: "成功パターン", icon: TrendingUp, color: "text-green-600 bg-green-50", xp: 50 },
  posting_style: { label: "投稿スタイル", icon: Sparkles, color: "text-blue-600 bg-blue-50", xp: 30 },
  comment_style: { label: "コメントスタイル", icon: MessageSquare, color: "text-purple-600 bg-purple-50", xp: 30 },
  hashtag_strategy: { label: "ハッシュタグ", icon: Hash, color: "text-cyan-600 bg-cyan-50", xp: 25 },
  timing_pattern: { label: "タイミング", icon: Clock, color: "text-orange-600 bg-orange-50", xp: 25 },
  failure_pattern: { label: "失敗パターン", icon: AlertTriangle, color: "text-red-600 bg-red-50", xp: 20 },
  engagement_pattern: { label: "エンゲージメント", icon: Zap, color: "text-yellow-600 bg-yellow-50", xp: 35 },
};

export default function AccountLearningsTab({ accountId }: AccountLearningsTabProps) {
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: learnings, isLoading } = trpc.accounts.learnings.useQuery({
    accountId,
    type: selectedType === "all" ? undefined : selectedType,
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const typeFilters = [
    { value: "all", label: "すべて" },
    { value: "success_pattern", label: "成功" },
    { value: "posting_style", label: "投稿" },
    { value: "comment_style", label: "コメント" },
    { value: "hashtag_strategy", label: "タグ" },
    { value: "failure_pattern", label: "失敗" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="bg-slate-100">
          {typeFilters.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value} className="text-sm">
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Learnings list */}
      {learnings && learnings.length > 0 ? (
        <div className="space-y-3">
          {learnings.map((learning) => {
            const config = LEARNING_TYPE_CONFIG[learning.learningType] || {
              label: learning.learningType,
              icon: Sparkles,
              color: "text-slate-600 bg-slate-50",
              xp: 20,
            };
            const Icon = config.icon;
            const content = learning.content || {};

            return (
              <Card key={learning.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          {learning.source && (
                            <Badge variant="secondary" className="text-xs">
                              {learning.source === "buzz_analysis" ? "バズ分析" : learning.source}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-slate-900 text-sm">
                          {content.title || content.pattern || "学習パターン"}
                        </h4>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {content.description || content.insight || JSON.stringify(content).slice(0, 100)}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span>信頼度: {learning.confidence}%</span>
                          <span>{new Date(learning.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">
                        <Zap className="h-3 w-3" />
                        +{learning.xpValue} XP
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">学習データがまだありません</p>
            <p className="text-sm text-slate-400 mt-1">
              投稿やモデルアカウント連携を通じて学習が蓄積されます
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
