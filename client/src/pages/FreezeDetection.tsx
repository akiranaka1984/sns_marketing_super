import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Filter } from "lucide-react";

export default function FreezeDetection() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");

  // Queries
  const detectionsQuery = trpc.freeze.getAll.useQuery({ limit: 100 });
  const accountsQuery = trpc.accounts.list.useQuery();

  const getDetectionTypeBadge = (type: string) => {
    switch (type) {
      case "ip_block":
        return <Badge variant="destructive">IPブロック</Badge>;
      case "device_block":
        return <Badge variant="destructive">デバイスブロック</Badge>;
      case "account_freeze":
        return <Badge variant="destructive">アカウント凍結</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ip_change":
        return <Badge variant="secondary">IP変更</Badge>;
      case "device_switch":
        return <Badge variant="secondary">デバイス切り替え</Badge>;
      case "account_pause":
        return <Badge variant="secondary">アカウント一時停止</Badge>;
      case "none":
        return <Badge variant="outline">対応なし</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const filteredDetections = detectionsQuery.data?.filter((detection: any) => {
    if (filterType !== "all" && detection.detectionType !== filterType) return false;
    if (filterAccount !== "all" && detection.accountId.toString() !== filterAccount) return false;
    return true;
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">凍結検知ログ</h1>
          <p className="text-muted-foreground">
            アカウント凍結の検知履歴と自動対応の結果
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => detectionsQuery.refetch()}
          disabled={detectionsQuery.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${detectionsQuery.isLoading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            フィルター
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">検知タイプ</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="ip_block">IPブロック</SelectItem>
                  <SelectItem value="device_block">デバイスブロック</SelectItem>
                  <SelectItem value="account_freeze">アカウント凍結</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">アカウント</label>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {accountsQuery.data?.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>検知履歴</CardTitle>
          <CardDescription>
            {filteredDetections?.length || 0}件の検知記録
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detectionsQuery.isLoading ? (
            <p className="text-center text-muted-foreground py-8">読み込み中...</p>
          ) : filteredDetections && filteredDetections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>検知日時</TableHead>
                  <TableHead>アカウント</TableHead>
                  <TableHead>検知タイプ</TableHead>
                  <TableHead>自動対応</TableHead>
                  <TableHead>結果</TableHead>
                  <TableHead>詳細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetections.map((detection: any) => {
                  const account = accountsQuery.data?.find((a) => a.id === detection.accountId);
                  return (
                    <TableRow key={detection.id}>
                      <TableCell>
                        {new Date(detection.detectedAt).toLocaleString("ja-JP")}
                      </TableCell>
                      <TableCell>{account?.username || `ID: ${detection.accountId}`}</TableCell>
                      <TableCell>{getDetectionTypeBadge(detection.detectionType)}</TableCell>
                      <TableCell>{getActionBadge(detection.autoAction)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(detection.actionSuccess)}
                          <span className="text-sm">
                            {detection.actionSuccess ? "成功" : "失敗"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {detection.details || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">検知記録がありません</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
