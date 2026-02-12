import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Play, Trash2, Calendar, Hash, User, Eye, Heart, MessageCircle, RefreshCw } from "lucide-react";

export default function ContentCollection() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<"twitter" | "tiktok" | "instagram" | "facebook" | "youtube" | "other">("twitter");
  const [keywords, setKeywords] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [accounts, setAccounts] = useState("");
  const [frequency, setFrequency] = useState<"hourly" | "daily" | "weekly">("daily");
  const [maxItems, setMaxItems] = useState("50");

  const { data: schedules, refetch: refetchSchedules } = trpc.contentCollection.listSchedules.useQuery({});
  const { data: contents, refetch: refetchContents } = trpc.contentCollection.listCollectedContent.useQuery({ limit: 100 });

  const createSchedule = trpc.contentCollection.createSchedule.useMutation({
    onSuccess: () => {
      toast.success("収集スケジュールを作成しました");
      setIsCreateDialogOpen(false);
      refetchSchedules();
      // Reset form
      setKeywords("");
      setHashtags("");
      setAccounts("");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const collectContent = trpc.contentCollection.collectContent.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.collectedCount}件のコンテンツを収集しました`);
      refetchContents();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteSchedule = trpc.contentCollection.deleteSchedule.useMutation({
    onSuccess: () => {
      toast.success("収集スケジュールを削除しました");
      refetchSchedules();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteContent = trpc.contentCollection.deleteCollectedContent.useMutation({
    onSuccess: () => {
      toast.success("コンテンツを削除しました");
      refetchContents();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleCreateSchedule = () => {
    const keywordArray = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const hashtagArray = hashtags.split(",").map((h) => h.trim()).filter(Boolean);
    const accountArray = accounts.split(",").map((a) => a.trim()).filter(Boolean);

    createSchedule.mutate({
      platform,
      searchKeywords: keywordArray.length > 0 ? keywordArray : undefined,
      searchHashtags: hashtagArray.length > 0 ? hashtagArray : undefined,
      searchAccounts: accountArray.length > 0 ? accountArray : undefined,
      frequency,
      maxItemsPerRun: parseInt(maxItems),
    });
  };

  const handleCollectNow = (scheduleId: number) => {
    collectContent.mutate({ scheduleId });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">コンテンツ収集</h1>
          <p className="text-muted-foreground">SNSプラットフォームからコンテンツを自動収集します</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              収集スケジュール作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>収集スケジュール作成</DialogTitle>
              <DialogDescription>
                コンテンツ収集のスケジュールを設定します
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="platform">プラットフォーム</Label>
                <Select value={platform} onValueChange={(value: any) => setPlatform(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="keywords">検索キーワード（カンマ区切り）</Label>
                <Input
                  id="keywords"
                  placeholder="AI, マーケティング, SNS"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hashtags">ハッシュタグ（カンマ区切り）</Label>
                <Input
                  id="hashtags"
                  placeholder="trending, viral, popular"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accounts">監視アカウント（カンマ区切り）</Label>
                <Input
                  id="accounts"
                  placeholder="@user1, @user2"
                  value={accounts}
                  onChange={(e) => setAccounts(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frequency">収集頻度</Label>
                <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">1時間ごと</SelectItem>
                    <SelectItem value="daily">1日ごと</SelectItem>
                    <SelectItem value="weekly">1週間ごと</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxItems">最大収集数</Label>
                <Input
                  id="maxItems"
                  type="number"
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreateSchedule} disabled={createSchedule.isPending}>
                {createSchedule.isPending ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Collection Schedules */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">収集スケジュール</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules?.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">{schedule.platform}</span>
                  <Badge variant={schedule.isActive ? "default" : "secondary"}>
                    {schedule.isActive ? "有効" : "無効"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {schedule.frequency === "hourly" && "1時間ごと"}
                  {schedule.frequency === "daily" && "1日ごと"}
                  {schedule.frequency === "weekly" && "1週間ごと"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {schedule.searchKeywords && schedule.searchKeywords.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">キーワード:</p>
                        <p className="text-muted-foreground">{schedule.searchKeywords.join(", ")}</p>
                      </div>
                    </div>
                  )}
                  {schedule.searchHashtags && schedule.searchHashtags.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">ハッシュタグ:</p>
                        <p className="text-muted-foreground">#{schedule.searchHashtags.join(", #")}</p>
                      </div>
                    </div>
                  )}
                  {schedule.searchAccounts && schedule.searchAccounts.length > 0 && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">アカウント:</p>
                        <p className="text-muted-foreground">{schedule.searchAccounts.join(", ")}</p>
                      </div>
                    </div>
                  )}
                  {schedule.lastRunAt && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">最終実行:</p>
                        <p className="text-muted-foreground">
                          {new Date(schedule.lastRunAt).toLocaleString("ja-JP")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => handleCollectNow(schedule.id)}
                    disabled={collectContent.isPending}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    今すぐ収集
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteSchedule.mutate({ id: schedule.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Collected Content */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">収集済みコンテンツ</h2>
        <div className="grid gap-4">
          {contents?.map((content) => (
            <Card key={content.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">{content.platform}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{content.author}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteContent.mutate({ id: content.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {new Date(content.collectedAt).toLocaleString("ja-JP")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{content.content}</p>
                {content.hashtags && content.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {content.hashtags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {content.views?.toLocaleString() || 0}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {content.likes?.toLocaleString() || 0}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {content.comments?.toLocaleString() || 0}</span>
                  <span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> {content.shares?.toLocaleString() || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
