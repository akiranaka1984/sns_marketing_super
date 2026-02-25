import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Hash, TrendingUp, Search, Users } from "lucide-react";

const getEngagementColor = (rate: number) => {
  if (rate >= 5) return "text-[#A8E6CF]";
  if (rate >= 3) return "text-[#FFD700]";
  if (rate >= 1) return "text-[#FFDAB9]";
  return "text-[#FF6B6B]";
};

const getTrendBadgeVariant = (score: number): "emerald" | "amber" | "rose" | "slate" => {
  if (score >= 70) return "emerald";
  if (score >= 40) return "amber";
  if (score >= 20) return "rose";
  return "slate";
};

export default function HashtagAnalytics() {
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [selectedHashtag, setSelectedHashtag] = useState("");

  // Section 1: Hashtag Performance Ranking
  const { data: hashtagRanking, isLoading: rankingLoading } =
    trpc.analytics.getHashtagRanking.useQuery(
      { limit: 50 },
      {
        retry: false,
      }
    );

  // Section 2: Hashtag Trends
  const { data: hashtagTrends, isLoading: trendsLoading } =
    trpc.analytics.getHashtagTrends.useQuery(
      { hashtag: selectedHashtag },
      {
        enabled: selectedHashtag.length > 0,
        retry: false,
      }
    );

  // Section 3: Model Account Hashtags
  const { data: modelAccountHashtags, isLoading: modelLoading } =
    trpc.analytics.getModelAccountHashtags.useQuery(
      {},
      {
        retry: false,
      }
    );

  const handleSearchHashtag = () => {
    if (hashtagSearch.trim()) {
      setSelectedHashtag(hashtagSearch.trim().replace(/^#/, ""));
    }
  };

  const rankingData = hashtagRanking ?? [];
  const trendsData = hashtagTrends ?? [];
  const modelHashtagData = modelAccountHashtags ?? { ownTopHashtags: [], modelTopHashtags: [], recommended: [] };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Page Header */}
      <div className="fade-in-up page-header">
        <div>
          <h2 className="text-lg font-bold text-[#1A1A1A]">
            ハッシュタグ分析
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5 font-bold">
            ハッシュタグの効果を追跡・分析
          </p>
        </div>
      </div>

      {/* Section 1: Hashtag Performance Ranking */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-2 mb-4">
          <Hash className="h-4 w-4 text-[#1A1A1A]" />
          <h3 className="text-sm font-bold text-[#1A1A1A]">
            ハッシュタグパフォーマンスランキング
          </h3>
        </div>

        {rankingLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
          </div>
        ) : rankingData.length === 0 ? (
          <div className="py-8 text-center text-[#6B6B6B] text-sm font-bold">
            ハッシュタグデータがありません
          </div>
        ) : (
          <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[2px_2px_0_#1A1A1A]">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FFD700] border-b-2 border-[#1A1A1A] hover:bg-[#FFD700]">
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    順位
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    ハッシュタグ
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    使用回数
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    平均いいね
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    平均コメント
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    平均シェア
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    平均ER
                  </TableHead>
                  <TableHead className="text-[11px] text-[#1A1A1A] font-bold uppercase tracking-wide">
                    トレンドスコア
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingData.map((item: any, index: number) => (
                  <TableRow
                    key={item.hashtag || index}
                    className="hover:bg-[#FFF8DC] transition-colors cursor-pointer bg-white border-b-2 border-[#1A1A1A] last:border-b-0"
                    onClick={() => {
                      setHashtagSearch(item.hashtag);
                      setSelectedHashtag(item.hashtag);
                    }}
                  >
                    <TableCell className="text-xs font-bold text-[#1A1A1A]">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-xs text-[#1A1A1A]">
                      <span className="font-bold">
                        #{item.hashtag}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-[#1A1A1A] font-bold">
                      {item.usageCount ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-[#1A1A1A] font-bold">
                      {item.avgLikes?.toFixed(1) ?? "0"}
                    </TableCell>
                    <TableCell className="text-xs text-[#1A1A1A] font-bold">
                      {item.avgComments?.toFixed(1) ?? "0"}
                    </TableCell>
                    <TableCell className="text-xs text-[#1A1A1A] font-bold">
                      {item.avgShares?.toFixed(1) ?? "0"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span
                        className={`font-bold ${getEngagementColor(item.avgEngagementRate ?? 0)}`}
                      >
                        {item.avgEngagementRate?.toFixed(2) ?? "0.00"}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={getTrendBadgeVariant(item.trendScore ?? 0)}>
                        {item.trendScore?.toFixed(0) ?? "0"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Section 2: Hashtag Trends */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[#1A1A1A]" />
          <h3 className="text-sm font-bold text-[#1A1A1A]">
            ハッシュタグトレンド
          </h3>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
            <Input
              placeholder="ハッシュタグを検索..."
              value={hashtagSearch}
              onChange={(e) => setHashtagSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchHashtag();
              }}
              className="pl-9 border-2 border-[#1A1A1A] shadow-[2px_2px_0_#1A1A1A] font-bold"
            />
          </div>
          <Button
            onClick={handleSearchHashtag}
            disabled={!hashtagSearch.trim()}
            className="bg-[#FFD700] hover:bg-[#FFD700] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] font-bold"
          >
            検索
          </Button>
        </div>

        {!selectedHashtag ? (
          <div className="py-8 text-center text-[#6B6B6B] text-sm font-bold">
            ハッシュタグを入力して検索してください
          </div>
        ) : trendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
          </div>
        ) : trendsData.length === 0 ? (
          <div className="py-8 text-center text-[#6B6B6B] text-sm font-bold">
            「#{selectedHashtag}」のトレンドデータが見つかりません
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#6B6B6B] mb-3 font-bold">
              #{selectedHashtag} のトレンド推移
            </p>
            <div className="border-2 border-[#1A1A1A] rounded-lg overflow-hidden shadow-[2px_2px_0_#1A1A1A]">
              {trendsData.map((entry: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2.5 border-b-2 border-[#1A1A1A] last:border-b-0 hover:bg-[#FFF8DC] transition-colors bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#6B6B6B] w-24 font-bold">
                      {entry.period || entry.date}
                    </span>
                    <span className="text-xs font-bold text-[#1A1A1A]">
                      {entry.usageCount ?? 0} 回使用
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-[#FF6B6B] font-bold">
                      &#9825; {entry.avgLikes?.toFixed(0) ?? "0"}
                    </span>
                    <span className="text-[#A8E6CF] font-bold">
                      &#128172; {entry.avgComments?.toFixed(0) ?? "0"}
                    </span>
                    <span className="text-[#87CEEB] font-bold">
                      &#8635; {entry.avgShares?.toFixed(0) ?? "0"}
                    </span>
                    <span
                      className={`font-bold ${getEngagementColor(entry.avgEngagementRate ?? 0)}`}
                    >
                      ER: {entry.avgEngagementRate?.toFixed(2) ?? "0.00"}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Model Account Hashtags */}
      <div className="fade-in-up bg-[#FFFDF7] rounded-lg border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0_#1A1A1A]">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-[#1A1A1A]" />
          <h3 className="text-sm font-bold text-[#1A1A1A]">
            モデルアカウントのハッシュタグ
          </h3>
        </div>

        {modelLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFD700]" />
          </div>
        ) : modelHashtagData.modelTopHashtags.length === 0 && modelHashtagData.recommended.length === 0 ? (
          <div className="py-8 text-center text-[#6B6B6B] text-sm font-bold">
            モデルアカウントのハッシュタグデータがありません
          </div>
        ) : (
          <div className="space-y-4">
            {/* Model top hashtags */}
            {modelHashtagData.modelTopHashtags.length > 0 && (
              <div>
                <p className="text-xs text-[#6B6B6B] mb-2 font-bold">モデルアカウントのトップハッシュタグ</p>
                <div className="flex flex-wrap gap-1.5">
                  {modelHashtagData.modelTopHashtags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-white cursor-pointer hover:bg-[#FFF8DC] transition-colors shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                      onClick={() => {
                        setHashtagSearch(tag.hashtag);
                        setSelectedHashtag(tag.hashtag.replace(/^#/, ""));
                      }}
                    >
                      #{tag.hashtag}
                      <span className="ml-1 text-[#6B6B6B]">
                        (ER: {tag.avgEngagement.toFixed(1)}%)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended hashtags */}
            {modelHashtagData.recommended.length > 0 && (
              <div>
                <p className="text-xs text-[#6B6B6B] mb-2 font-bold">おすすめハッシュタグ</p>
                <div className="flex flex-wrap gap-1.5">
                  {modelHashtagData.recommended.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-[#4ECDC4] border-2 border-[#1A1A1A] text-[#1A1A1A] cursor-pointer hover:bg-[#A8E6CF] transition-colors shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                      onClick={() => {
                        setHashtagSearch(tag);
                        setSelectedHashtag(tag.replace(/^#/, ""));
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Own top hashtags comparison */}
            {modelHashtagData.ownTopHashtags.length > 0 && (
              <div>
                <p className="text-xs text-[#6B6B6B] mb-2 font-bold">自分のトップハッシュタグ</p>
                <div className="flex flex-wrap gap-1.5">
                  {modelHashtagData.ownTopHashtags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border-2 border-[#1A1A1A] text-[#1A1A1A] bg-white cursor-pointer hover:bg-[#FFF8DC] transition-colors shadow-[2px_2px_0_#1A1A1A] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                      onClick={() => {
                        setHashtagSearch(tag.hashtag);
                        setSelectedHashtag(tag.hashtag.replace(/^#/, ""));
                      }}
                    >
                      #{tag.hashtag}
                      <span className="ml-1 text-[#6B6B6B]">
                        (ER: {tag.avgEngagement.toFixed(1)}%)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
