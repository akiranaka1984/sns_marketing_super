/**
 * Conversion Funnel Tracking Service
 *
 * キャンペーンのコンバージョンファネルを追跡・分析するサービス
 * UTMリンク生成、イベント記録、ファネル分析、ROIレポートを提供
 */

import { db } from "../db";
import {
  campaigns,
  conversionEvents,
  trackedLinks,
  projects,
  posts,
  postAnalytics,
  accounts,
} from "../../drizzle/schema";
import { eq, and, gte, desc, sql, sum, count } from "drizzle-orm";

const LOG_PREFIX = "[ConversionTracker]";

// ==========================================
// Types
// ==========================================

interface CreateCampaignData {
  userId: number;
  projectId: number;
  name: string;
  goal: "awareness" | "traffic" | "leads" | "sales" | "engagement";
  targetUrl?: string;
  budget?: string;
  startDate?: string;
  endDate?: string;
}

interface RecordConversionEventData {
  campaignId?: number;
  accountId?: number;
  postId?: number;
  trackedLinkId?: number;
  eventType:
    | "impression"
    | "engagement"
    | "profile_visit"
    | "follow"
    | "link_click"
    | "page_view"
    | "signup"
    | "purchase";
  eventValue?: string;
  metadata?: string;
}

interface FunnelStep {
  eventType: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
}

interface ROIReport {
  byCampaign: Array<{
    campaignId: number;
    campaignName: string;
    goal: string;
    spend: number;
    revenue: number;
    roi: number;
    totalEvents: number;
  }>;
  byAccount: Array<{
    accountId: number;
    username: string;
    platform: string;
    totalEvents: number;
    totalRevenue: number;
  }>;
  byContentType: Array<{
    eventType: string;
    count: number;
    totalValue: number;
  }>;
  summary: {
    totalSpend: number;
    totalRevenue: number;
    overallROI: number;
    totalCampaigns: number;
  };
}

// ==========================================
// Campaign Management
// ==========================================

/**
 * 新しいキャンペーンを作成
 * UTMパラメータを自動生成
 */
export async function createCampaign(data: CreateCampaignData) {
  const utmCampaign = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  console.log(`${LOG_PREFIX} Creating campaign: ${data.name} (utm_campaign=${utmCampaign})`);

  const [result] = await db.insert(campaigns).values({
    userId: data.userId,
    projectId: data.projectId,
    name: data.name,
    goal: data.goal,
    targetUrl: data.targetUrl ?? null,
    utmSource: "sns_automation",
    utmMedium: "social",
    utmCampaign,
    budget: data.budget ?? null,
    status: "draft",
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
  });

  console.log(`${LOG_PREFIX} Campaign created with ID: ${result.insertId}`);
  return result.insertId;
}

/**
 * キャンペーンをスタッツ付きで取得
 */
export async function getCampaign(campaignId: number) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) {
    return null;
  }

  const stats = await getCampaignStats(campaignId);

  return {
    ...campaign,
    stats,
  };
}

/**
 * プロジェクトの全キャンペーンをサマリメトリクス付きで取得
 */
export async function listCampaigns(projectId: number) {
  const campaignList = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.projectId, projectId))
    .orderBy(desc(campaigns.createdAt));

  const results = await Promise.all(
    campaignList.map(async (campaign) => {
      const stats = await getCampaignStats(campaign.id);
      return {
        ...campaign,
        stats,
      };
    })
  );

  return results;
}

/**
 * キャンペーンのROIを計算して更新
 */
export async function updateCampaignROI(campaignId: number) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) {
    console.log(`${LOG_PREFIX} Campaign not found: ${campaignId}`);
    return null;
  }

  // 購入イベントの合計値を取得
  const [revenueResult] = await db
    .select({
      totalRevenue: sum(conversionEvents.eventValue),
    })
    .from(conversionEvents)
    .where(
      and(
        eq(conversionEvents.campaignId, campaignId),
        eq(conversionEvents.eventType, "purchase")
      )
    );

  const revenue = Number(revenueResult?.totalRevenue ?? 0);
  const budget = Number(campaign.budget ?? 0);
  const roi = budget > 0 ? ((revenue - budget) / budget) * 100 : 0;

  await db
    .update(campaigns)
    .set({
      revenue: String(revenue),
      roi: String(roi),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  console.log(
    `${LOG_PREFIX} Updated ROI for campaign ${campaignId}: revenue=${revenue}, budget=${budget}, roi=${roi.toFixed(2)}%`
  );

  return { revenue, budget, roi };
}

// ==========================================
// UTM Link Generation
// ==========================================

/**
 * UTMパラメータ付きの追跡リンクを生成
 */
export async function generateTrackedLink(
  campaignId: number,
  accountId: number,
  postId: number,
  originalUrl: string
) {
  // キャンペーン名を取得
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) {
    throw new Error(`${LOG_PREFIX} Campaign not found: ${campaignId}`);
  }

  const campaignSlug = campaign.utmCampaign || campaign.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  // UTMパラメータを構築
  const utmParams = new URLSearchParams({
    utm_source: "sns_auto",
    utm_medium: "social",
    utm_campaign: campaignSlug,
    utm_content: String(postId),
    utm_term: String(accountId),
  });

  // 元のURLにUTMパラメータを付与
  const separator = originalUrl.includes("?") ? "&" : "?";
  const trackedUrl = `${originalUrl}${separator}${utmParams.toString()}`;

  // DB保存
  const [result] = await db.insert(trackedLinks).values({
    campaignId,
    accountId,
    postId,
    originalUrl,
    trackedUrl,
    clickCount: 0,
    uniqueClickCount: 0,
  });

  console.log(
    `${LOG_PREFIX} Generated tracked link (ID: ${result.insertId}) for campaign ${campaignId}`
  );

  return {
    id: result.insertId,
    originalUrl,
    trackedUrl,
  };
}

/**
 * 投稿コンテンツ内のURLを自動的にUTMタグ付きに置換
 */
export async function autoTagPostLinks(
  postContent: string,
  campaignId: number,
  accountId: number,
  postId: number
): Promise<string> {
  // URL正規表現パターン
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = postContent.match(urlPattern);

  if (!urls || urls.length === 0) {
    console.log(`${LOG_PREFIX} No URLs found in post content for post ${postId}`);
    return postContent;
  }

  let modifiedContent = postContent;

  for (const url of urls) {
    try {
      const { trackedUrl } = await generateTrackedLink(
        campaignId,
        accountId,
        postId,
        url
      );
      modifiedContent = modifiedContent.replace(url, trackedUrl);
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to tag URL ${url}:`, error);
      // タグ付け失敗時は元のURLを維持
    }
  }

  console.log(
    `${LOG_PREFIX} Auto-tagged ${urls.length} URLs in post ${postId} for campaign ${campaignId}`
  );

  return modifiedContent;
}

// ==========================================
// Event Recording
// ==========================================

/**
 * コンバージョンイベントを記録
 */
export async function recordConversionEvent(data: RecordConversionEventData) {
  const [result] = await db.insert(conversionEvents).values({
    campaignId: data.campaignId ?? null,
    accountId: data.accountId ?? null,
    postId: data.postId ?? null,
    trackedLinkId: data.trackedLinkId ?? null,
    eventType: data.eventType,
    eventValue: data.eventValue ?? null,
    metadata: data.metadata ?? null,
  });

  console.log(
    `${LOG_PREFIX} Recorded conversion event: type=${data.eventType}, campaign=${data.campaignId ?? "none"}, value=${data.eventValue ?? "none"}`
  );

  return result.insertId;
}

/**
 * リンククリックを記録
 * trackedLinksのclickCountをインクリメントし、コンバージョンイベントも記録
 */
export async function recordLinkClick(trackedLinkId: number) {
  // クリック数をインクリメント
  await db
    .update(trackedLinks)
    .set({
      clickCount: sql`${trackedLinks.clickCount} + 1`,
      lastClickedAt: new Date(),
    })
    .where(eq(trackedLinks.id, trackedLinkId));

  // リンク情報を取得してコンバージョンイベントを記録
  const [link] = await db
    .select()
    .from(trackedLinks)
    .where(eq(trackedLinks.id, trackedLinkId));

  if (link) {
    await recordConversionEvent({
      campaignId: link.campaignId ?? undefined,
      accountId: link.accountId ?? undefined,
      postId: link.postId ?? undefined,
      trackedLinkId: link.id,
      eventType: "link_click",
    });
  }

  console.log(`${LOG_PREFIX} Recorded link click for tracked link: ${trackedLinkId}`);
}

// ==========================================
// Funnel Analysis
// ==========================================

/**
 * キャンペーンのファネル分析を取得
 * impression -> engagement -> profile_visit -> follow -> link_click -> signup -> purchase
 */
export async function getFunnelAnalysis(campaignId: number) {
  const funnelSteps: Array<
    | "impression"
    | "engagement"
    | "profile_visit"
    | "follow"
    | "link_click"
    | "signup"
    | "purchase"
  > = [
    "impression",
    "engagement",
    "profile_visit",
    "follow",
    "link_click",
    "signup",
    "purchase",
  ];

  // 各ステップのイベント数を取得
  const eventCounts = await db
    .select({
      eventType: conversionEvents.eventType,
      eventCount: count(),
    })
    .from(conversionEvents)
    .where(eq(conversionEvents.campaignId, campaignId))
    .groupBy(conversionEvents.eventType);

  const countMap: Record<string, number> = {};
  for (const row of eventCounts) {
    countMap[row.eventType] = Number(row.eventCount);
  }

  // ファネルデータを構築
  const funnel: FunnelStep[] = [];
  let previousCount = 0;

  for (let i = 0; i < funnelSteps.length; i++) {
    const step = funnelSteps[i];
    const currentCount = countMap[step] || 0;

    const conversionRate =
      i === 0
        ? 100
        : previousCount > 0
          ? (currentCount / previousCount) * 100
          : 0;

    const dropOffRate = 100 - conversionRate;

    funnel.push({
      eventType: step,
      count: currentCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
      dropOffRate: Math.round(dropOffRate * 100) / 100,
    });

    if (currentCount > 0) {
      previousCount = currentCount;
    }
  }

  // 全体のコンバージョン率を計算
  const topOfFunnel = countMap["impression"] || 0;
  const bottomOfFunnel = countMap["purchase"] || 0;
  const overallConversionRate =
    topOfFunnel > 0 ? (bottomOfFunnel / topOfFunnel) * 100 : 0;

  console.log(
    `${LOG_PREFIX} Funnel analysis for campaign ${campaignId}: overall conversion=${overallConversionRate.toFixed(2)}%`
  );

  return {
    campaignId,
    funnel,
    overallConversionRate: Math.round(overallConversionRate * 100) / 100,
    totalImpressions: topOfFunnel,
    totalPurchases: bottomOfFunnel,
  };
}

/**
 * プロジェクトのROIレポートを取得
 */
export async function getROIReport(
  projectId: number,
  dateRange?: { start: Date; end: Date }
): Promise<ROIReport> {
  // --- キャンペーン別集計 ---
  const campaignList = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.projectId, projectId));

  const byCampaign = await Promise.all(
    campaignList.map(async (campaign) => {
      const conditions = [eq(conversionEvents.campaignId, campaign.id)];
      if (dateRange?.start) {
        conditions.push(gte(conversionEvents.occurredAt, dateRange.start.toISOString()));
      }

      const [eventStats] = await db
        .select({
          totalEvents: count(),
          totalRevenue: sum(conversionEvents.eventValue),
        })
        .from(conversionEvents)
        .where(and(...conditions));

      const spend = Number(campaign.budget ?? 0);
      const revenue = Number(eventStats?.totalRevenue ?? 0);
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        goal: campaign.goal,
        spend,
        revenue,
        roi: Math.round(roi * 100) / 100,
        totalEvents: Number(eventStats?.totalEvents ?? 0),
      };
    })
  );

  // --- アカウント別集計 ---
  const campaignIds = campaignList.map((c) => c.id);

  let byAccount: ROIReport["byAccount"] = [];
  if (campaignIds.length > 0) {
    const accountEvents = await db
      .select({
        accountId: conversionEvents.accountId,
        totalEvents: count(),
        totalRevenue: sum(conversionEvents.eventValue),
      })
      .from(conversionEvents)
      .where(
        and(
          sql`${conversionEvents.campaignId} IN (${sql.join(
            campaignIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          sql`${conversionEvents.accountId} IS NOT NULL`,
          ...(dateRange?.start
            ? [gte(conversionEvents.occurredAt, dateRange.start.toISOString())]
            : [])
        )
      )
      .groupBy(conversionEvents.accountId);

    byAccount = await Promise.all(
      accountEvents.map(async (row) => {
        let username = "unknown";
        let platform = "unknown";

        if (row.accountId) {
          const [account] = await db
            .select({
              username: accounts.username,
              platform: accounts.platform,
            })
            .from(accounts)
            .where(eq(accounts.id, row.accountId));

          if (account) {
            username = account.username;
            platform = account.platform;
          }
        }

        return {
          accountId: row.accountId!,
          username,
          platform,
          totalEvents: Number(row.totalEvents),
          totalRevenue: Number(row.totalRevenue ?? 0),
        };
      })
    );
  }

  // --- コンテンツタイプ（イベントタイプ）別集計 ---
  let byContentType: ROIReport["byContentType"] = [];
  if (campaignIds.length > 0) {
    const contentTypeEvents = await db
      .select({
        eventType: conversionEvents.eventType,
        eventCount: count(),
        totalValue: sum(conversionEvents.eventValue),
      })
      .from(conversionEvents)
      .where(
        and(
          sql`${conversionEvents.campaignId} IN (${sql.join(
            campaignIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          ...(dateRange?.start
            ? [gte(conversionEvents.occurredAt, dateRange.start.toISOString())]
            : [])
        )
      )
      .groupBy(conversionEvents.eventType);

    byContentType = contentTypeEvents.map((row) => ({
      eventType: row.eventType,
      count: Number(row.eventCount),
      totalValue: Number(row.totalValue ?? 0),
    }));
  }

  // --- サマリー ---
  const totalSpend = byCampaign.reduce((acc, c) => acc + c.spend, 0);
  const totalRevenue = byCampaign.reduce((acc, c) => acc + c.revenue, 0);
  const overallROI =
    totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  console.log(
    `${LOG_PREFIX} ROI report for project ${projectId}: spend=${totalSpend}, revenue=${totalRevenue}, roi=${overallROI.toFixed(2)}%`
  );

  return {
    byCampaign,
    byAccount,
    byContentType,
    summary: {
      totalSpend,
      totalRevenue,
      overallROI: Math.round(overallROI * 100) / 100,
      totalCampaigns: campaignList.length,
    },
  };
}

// ==========================================
// Helpers
// ==========================================

/**
 * キャンペーンのクイックサマリーを取得
 */
export async function getCampaignStats(campaignId: number) {
  const [eventStats] = await db
    .select({
      totalEvents: count(),
      totalRevenue: sum(conversionEvents.eventValue),
    })
    .from(conversionEvents)
    .where(eq(conversionEvents.campaignId, campaignId));

  const [linkStats] = await db
    .select({
      totalLinks: count(),
      totalClicks: sum(trackedLinks.clickCount),
    })
    .from(trackedLinks)
    .where(eq(trackedLinks.campaignId, campaignId));

  // イベントタイプ別の内訳
  const eventBreakdown = await db
    .select({
      eventType: conversionEvents.eventType,
      eventCount: count(),
    })
    .from(conversionEvents)
    .where(eq(conversionEvents.campaignId, campaignId))
    .groupBy(conversionEvents.eventType);

  const breakdown: Record<string, number> = {};
  for (const row of eventBreakdown) {
    breakdown[row.eventType] = Number(row.eventCount);
  }

  return {
    totalEvents: Number(eventStats?.totalEvents ?? 0),
    totalRevenue: Number(eventStats?.totalRevenue ?? 0),
    totalLinks: Number(linkStats?.totalLinks ?? 0),
    totalClicks: Number(linkStats?.totalClicks ?? 0),
    eventBreakdown: breakdown,
  };
}

/**
 * 最もパフォーマンスの高いコンテンツを取得
 * コンバージョンイベント数が最も多い投稿を返す
 */
export async function getTopPerformingContent(
  projectId: number,
  limit: number = 10
) {
  // プロジェクトに紐づくキャンペーンを取得
  const projectCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.projectId, projectId));

  const campaignIds = projectCampaigns.map((c) => c.id);

  if (campaignIds.length === 0) {
    console.log(`${LOG_PREFIX} No campaigns found for project ${projectId}`);
    return [];
  }

  // 投稿ごとのコンバージョンイベント数を集計
  const topContent = await db
    .select({
      postId: conversionEvents.postId,
      totalEvents: count(),
      totalRevenue: sum(conversionEvents.eventValue),
    })
    .from(conversionEvents)
    .where(
      and(
        sql`${conversionEvents.campaignId} IN (${sql.join(
          campaignIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        sql`${conversionEvents.postId} IS NOT NULL`
      )
    )
    .groupBy(conversionEvents.postId)
    .orderBy(desc(count()))
    .limit(limit);

  // 投稿の詳細情報を付加
  const results = await Promise.all(
    topContent.map(async (row) => {
      let postData = null;
      let analyticsData = null;

      if (row.postId) {
        const [post] = await db
          .select()
          .from(posts)
          .where(eq(posts.id, row.postId));
        postData = post ?? null;

        const [analytics] = await db
          .select()
          .from(postAnalytics)
          .where(eq(postAnalytics.postId, row.postId))
          .orderBy(desc(postAnalytics.recordedAt))
          .limit(1);
        analyticsData = analytics ?? null;
      }

      return {
        postId: row.postId,
        totalConversionEvents: Number(row.totalEvents),
        totalRevenue: Number(row.totalRevenue ?? 0),
        post: postData,
        analytics: analyticsData,
      };
    })
  );

  console.log(
    `${LOG_PREFIX} Found ${results.length} top performing content items for project ${projectId}`
  );

  return results;
}
