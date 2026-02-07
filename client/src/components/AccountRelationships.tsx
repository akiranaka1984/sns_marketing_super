import { useState, useEffect } from "react";
import { Users, Heart, UserPlus, Loader2, RefreshCw, Save, Trash2, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AccountRelationshipsProps {
  projectId: number;
}

const RELATIONSHIP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  friend: { label: "友人", color: "bg-green-100 text-green-800" },
  acquaintance: { label: "知人", color: "bg-blue-100 text-blue-800" },
  follower: { label: "フォロワー", color: "bg-purple-100 text-purple-800" },
  colleague: { label: "同僚", color: "bg-yellow-100 text-yellow-800" },
  rival: { label: "ライバル", color: "bg-red-100 text-red-800" },
  stranger: { label: "他人", color: "bg-slate-100 text-slate-800" },
};

const COMMENT_STYLE_LABELS: Record<string, string> = {
  supportive: "応援系",
  curious: "興味津々",
  playful: "いじり系",
  professional: "専門家",
  neutral: "中立",
};

const REACTION_TYPES = [
  { value: 'like', label: 'いいね' },
  { value: 'comment', label: 'コメント' },
  { value: 'retweet', label: 'リツイート' },
];

export default function AccountRelationships({ projectId }: AccountRelationshipsProps) {
  const [selectedRelationship, setSelectedRelationship] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    intimacyLevel: 50,
    relationshipType: 'acquaintance' as string,
    interactionProbability: 70,
    preferredReactionTypes: ['like', 'comment'] as string[],
    commentStyle: 'neutral' as string,
    notes: '',
  });

  // Fetch relationships
  const { data: relationships, isLoading, refetch } =
    trpc.accountRelationships.listByProject.useQuery({ projectId });

  // Fetch matrix for visualization
  const { data: matrixData } =
    trpc.accountRelationships.getMatrix.useQuery({ projectId });

  // Mutations
  const initializeMutation = trpc.accountRelationships.initializeForProject.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.created}件の関係性を作成しました`);
      refetch();
    },
    onError: () => {
      toast.error("関係性の初期化に失敗しました");
    },
  });

  const updateMutation = trpc.accountRelationships.update.useMutation({
    onSuccess: () => {
      toast.success("関係性を更新しました");
      refetch();
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast.error("関係性の更新に失敗しました");
    },
  });

  const deleteMutation = trpc.accountRelationships.delete.useMutation({
    onSuccess: () => {
      toast.success("関係性を削除しました");
      refetch();
    },
    onError: () => {
      toast.error("関係性の削除に失敗しました");
    },
  });

  const handleEditRelationship = (relationship: any) => {
    setSelectedRelationship(relationship);
    setEditForm({
      intimacyLevel: relationship.intimacyLevel,
      relationshipType: relationship.relationshipType,
      interactionProbability: relationship.interactionProbability,
      preferredReactionTypes: relationship.preferredReactionTypes
        ? JSON.parse(relationship.preferredReactionTypes)
        : ['like', 'comment'],
      commentStyle: relationship.commentStyle || 'neutral',
      notes: relationship.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveRelationship = () => {
    if (!selectedRelationship) return;

    updateMutation.mutate({
      id: selectedRelationship.id,
      ...editForm,
      relationshipType: editForm.relationshipType as any,
      commentStyle: editForm.commentStyle as any,
      preferredReactionTypes: editForm.preferredReactionTypes as any,
    });
  };

  const toggleReactionType = (type: string) => {
    const newTypes = editForm.preferredReactionTypes.includes(type)
      ? editForm.preferredReactionTypes.filter(t => t !== type)
      : [...editForm.preferredReactionTypes, type];
    setEditForm({ ...editForm, preferredReactionTypes: newTypes });
  };

  const getIntimacyColor = (level: number) => {
    if (level >= 80) return "text-green-600 bg-green-50";
    if (level >= 60) return "text-blue-600 bg-blue-50";
    if (level >= 40) return "text-yellow-600 bg-yellow-50";
    if (level >= 20) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              アカウント間の関係性
            </CardTitle>
            <CardDescription>
              アカウント間の親密度や反応パターンを設定します
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
              variant="outline"
              size="sm"
              onClick={() => initializeMutation.mutate({
                projectId,
                defaultIntimacyLevel: 50,
                defaultRelationshipType: 'acquaintance',
              })}
              disabled={initializeMutation.isPending}
            >
              {initializeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              関係性を初期化
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info Box */}
        <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">関係性について</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>親密度が高いアカウントは、投稿に反応する確率が高くなります</li>
                <li>関係タイプに応じてコメントスタイルが変わります</li>
                <li>好みの反応タイプを設定すると、その反応のみが行われます</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Matrix Visualization */}
        {matrixData && matrixData.accounts.length > 0 && (
          <div className="overflow-x-auto">
            <div className="text-sm font-medium mb-2">関係性マトリクス</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border bg-slate-50"></th>
                  {matrixData.accounts.map((account: any) => (
                    <th key={account.id} className="p-2 border bg-slate-50 text-center min-w-[120px]">
                      <div className="truncate" title={`@${account.username}`}>
                        @{account.username}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.accounts.map((fromAccount: any) => (
                  <tr key={fromAccount.id}>
                    <td className="p-2 border bg-slate-50 font-medium min-w-[120px]">
                      <div className="truncate" title={`@${fromAccount.username}`}>
                        @{fromAccount.username}
                      </div>
                    </td>
                    {matrixData.accounts.map((toAccount: any) => {
                      // JSON serialization converts numeric keys to strings
                      const relationship = (matrixData.matrix as any)[String(fromAccount.id)]?.[String(toAccount.id)];
                      return (
                        <td
                          key={toAccount.id}
                          className={`p-2 border text-center cursor-pointer transition-colors ${
                            fromAccount.id === toAccount.id
                              ? 'bg-slate-200'
                              : relationship
                              ? `${getIntimacyColor(relationship.intimacyLevel)} hover:opacity-80`
                              : 'bg-white hover:bg-slate-50'
                          }`}
                          onClick={() => relationship && handleEditRelationship(relationship)}
                        >
                          {fromAccount.id === toAccount.id ? (
                            '-'
                          ) : relationship ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="font-medium">{relationship.intimacyLevel}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{RELATIONSHIP_TYPE_LABELS[relationship.relationshipType]?.label}</p>
                                  <p>確率: {relationship.interactionProbability}%</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Relationship List */}
        {relationships && relationships.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium mb-2">設定済みの関係性 ({relationships.length}件)</div>
            <div className="grid gap-2 max-h-[400px] overflow-y-auto">
              {relationships.map((rel: any) => (
                <div
                  key={rel.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleEditRelationship(rel)}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          @{rel.fromAccount?.username || '?'}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-sm">
                          @{rel.toAccount?.username || '?'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={RELATIONSHIP_TYPE_LABELS[rel.relationshipType]?.color}
                        >
                          {RELATIONSHIP_TYPE_LABELS[rel.relationshipType]?.label}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          親密度: {rel.intimacyLevel}%
                        </span>
                        <span className="text-xs text-slate-500">
                          反応確率: {rel.interactionProbability}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ id: rel.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Users className="h-12 w-12 mx-auto mb-2 text-slate-300" />
            <p>関係性が設定されていません</p>
            <p className="text-sm">「関係性を初期化」ボタンで自動作成できます</p>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>関係性を編集</DialogTitle>
            <DialogDescription>
              {selectedRelationship && (
                <>
                  @{selectedRelationship.fromAccount?.username} → @{selectedRelationship.toAccount?.username}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Intimacy Level */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>親密度</Label>
                <span className="text-sm font-medium">{editForm.intimacyLevel}%</span>
              </div>
              <Slider
                value={[editForm.intimacyLevel]}
                onValueChange={([value]) => setEditForm({ ...editForm, intimacyLevel: value })}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-slate-500">
                高いほど反応する確率が上がります
              </p>
            </div>

            {/* Relationship Type */}
            <div className="space-y-2">
              <Label>関係タイプ</Label>
              <Select
                value={editForm.relationshipType}
                onValueChange={(value) => setEditForm({ ...editForm, relationshipType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_TYPE_LABELS).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interaction Probability */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>反応確率</Label>
                <span className="text-sm font-medium">{editForm.interactionProbability}%</span>
              </div>
              <Slider
                value={[editForm.interactionProbability]}
                onValueChange={([value]) => setEditForm({ ...editForm, interactionProbability: value })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            {/* Preferred Reaction Types */}
            <div className="space-y-2">
              <Label>好みの反応タイプ</Label>
              <div className="flex gap-4">
                {REACTION_TYPES.map(({ value, label }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`reaction-${value}`}
                      checked={editForm.preferredReactionTypes.includes(value)}
                      onCheckedChange={() => toggleReactionType(value)}
                    />
                    <label
                      htmlFor={`reaction-${value}`}
                      className="text-sm cursor-pointer"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment Style */}
            <div className="space-y-2">
              <Label>コメントスタイル</Label>
              <Select
                value={editForm.commentStyle}
                onValueChange={(value) => setEditForm({ ...editForm, commentStyle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMENT_STYLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>メモ（任意）</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="この関係性についてのメモ..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSaveRelationship}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
