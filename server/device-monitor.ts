/**
 * Device Monitor Service
 * Monitors DuoPlus device status and triggers alerts on anomalies
 */

import { db } from "./db";
import { 
  deviceStatusHistory, 
  deviceMonitoringStatus, 
  alertHistory,
  alertSettings
} from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { listDevices } from "./duoplus";
import { notifyOwner } from "./_core/notification";

// Status mapping from DuoPlus API
const STATUS_MAP: Record<number, "running" | "stopped" | "error" | "unknown"> = {
  1: "running",
  2: "stopped",
  0: "unknown",
};

interface DeviceStatus {
  deviceId: string;
  deviceName: string;
  status: "running" | "stopped" | "error" | "unknown";
  ipAddress?: string;
  osVersion?: string;
  errorMessage?: string;
}

interface AlertConfig {
  type: string;
  threshold: number;
  cooldownMinutes: number;
  notifyOwner: boolean;
}

// Default alert configurations
const DEFAULT_ALERT_CONFIGS: AlertConfig[] = [
  { type: "device_stopped", threshold: 1, cooldownMinutes: 60, notifyOwner: true },
  { type: "device_error", threshold: 1, cooldownMinutes: 30, notifyOwner: true },
  { type: "device_offline", threshold: 3, cooldownMinutes: 60, notifyOwner: true },
  { type: "consecutive_failures", threshold: 5, cooldownMinutes: 120, notifyOwner: true },
];

/**
 * Fetch current device statuses from DuoPlus API
 */
export async function fetchDeviceStatuses(): Promise<DeviceStatus[]> {
  try {
    const devices = await listDevices();
    
    return devices.map((device: any) => ({
      deviceId: device.id,
      deviceName: device.name || device.id,
      status: STATUS_MAP[device.status] || "unknown",
      ipAddress: device.ip,
      osVersion: device.os,
      errorMessage: device.status === 0 ? "Device not responding" : undefined,
    }));
  } catch (error) {
    console.error("[DeviceMonitor] Failed to fetch device statuses:", error);
    throw error;
  }
}

/**
 * Update device monitoring status in database
 */
export async function updateDeviceMonitoringStatus(
  deviceStatus: DeviceStatus
): Promise<{ statusChanged: boolean; previousStatus?: string }> {
  const now = new Date();
  
  // Get current monitoring status
  const [existing] = await db
    .select()
    .from(deviceMonitoringStatus)
    .where(eq(deviceMonitoringStatus.deviceId, deviceStatus.deviceId))
    .limit(1);

  const statusChanged = existing && existing.currentStatus !== deviceStatus.status;
  const previousStatus = existing?.currentStatus;

  if (existing) {
    // Update existing record
    await db
      .update(deviceMonitoringStatus)
      .set({
        deviceName: deviceStatus.deviceName,
        lastKnownStatus: existing.currentStatus,
        currentStatus: deviceStatus.status,
        lastCheckedAt: now,
        lastSuccessfulCheck: deviceStatus.status === "running" ? now : existing.lastSuccessfulCheck,
        lastErrorAt: deviceStatus.status === "error" ? now : existing.lastErrorAt,
        lastErrorMessage: deviceStatus.errorMessage || existing.lastErrorMessage,
        consecutiveErrors: deviceStatus.status === "error" 
          ? existing.consecutiveErrors + 1 
          : deviceStatus.status === "running" ? 0 : existing.consecutiveErrors,
      })
      .where(eq(deviceMonitoringStatus.deviceId, deviceStatus.deviceId));
  } else {
    // Create new record
    await db.insert(deviceMonitoringStatus).values({
      deviceId: deviceStatus.deviceId,
      deviceName: deviceStatus.deviceName,
      currentStatus: deviceStatus.status,
      lastCheckedAt: now,
      lastSuccessfulCheck: deviceStatus.status === "running" ? now : null,
      lastErrorAt: deviceStatus.status === "error" ? now : null,
      lastErrorMessage: deviceStatus.errorMessage,
      consecutiveErrors: deviceStatus.status === "error" ? 1 : 0,
    });
  }

  // Record status history if changed
  if (statusChanged || !existing) {
    await db.insert(deviceStatusHistory).values({
      deviceId: deviceStatus.deviceId,
      deviceName: deviceStatus.deviceName,
      status: deviceStatus.status,
      previousStatus: previousStatus as any,
      ipAddress: deviceStatus.ipAddress,
      osVersion: deviceStatus.osVersion,
      errorMessage: deviceStatus.errorMessage,
      detectedAt: now,
    });
  }

  return { statusChanged, previousStatus };
}

/**
 * Check if an alert should be triggered based on settings
 */
export async function shouldTriggerAlert(
  userId: number,
  alertType: string,
  deviceId?: string
): Promise<boolean> {
  // Get alert settings for this type
  const [settings] = await db
    .select()
    .from(alertSettings)
    .where(
      and(
        eq(alertSettings.userId, userId),
        eq(alertSettings.alertType, alertType as any)
      )
    )
    .limit(1);

  // If no settings, use defaults
  const config = settings || DEFAULT_ALERT_CONFIGS.find(c => c.type === alertType);
  if (!config || (settings && !settings.isEnabled)) {
    return false;
  }

  // Check cooldown - find last alert of this type
  const defaultConfig = DEFAULT_ALERT_CONFIGS.find(c => c.type === alertType);
  const cooldownMinutes = settings?.cooldownMinutes || defaultConfig?.cooldownMinutes || 60;
  const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const [recentAlert] = await db
    .select()
    .from(alertHistory)
    .where(
      and(
        eq(alertHistory.userId, userId),
        eq(alertHistory.alertType, alertType as any),
        deviceId ? eq(alertHistory.deviceId, deviceId) : sql`1=1`,
        sql`${alertHistory.triggeredAt} > ${cooldownTime}`
      )
    )
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(1);

  // Don't trigger if within cooldown period
  if (recentAlert) {
    return false;
  }

  return true;
}

/**
 * Create and send an alert
 */
export async function createAlert(
  userId: number,
  alertType: string,
  title: string,
  message: string,
  severity: "low" | "medium" | "high" | "critical",
  deviceId?: string,
  accountId?: number,
  postId?: number
): Promise<number | null> {
  const shouldAlert = await shouldTriggerAlert(userId, alertType, deviceId);
  
  if (!shouldAlert) {
    console.log(`[DeviceMonitor] Alert suppressed (cooldown): ${alertType} for device ${deviceId}`);
    return null;
  }

  // Create alert record
  const [result] = await db.insert(alertHistory).values({
    userId,
    alertType: alertType as any,
    deviceId,
    accountId,
    postId,
    title,
    message,
    severity,
    status: "triggered",
    triggeredAt: new Date(),
  });

  const alertId = result.insertId;

  // Send notification to owner
  try {
    const notificationSent = await notifyOwner({
      title: `[${severity.toUpperCase()}] ${title}`,
      content: message,
    });

    if (notificationSent) {
      await db
        .update(alertHistory)
        .set({
          notificationSent: true,
          notificationSentAt: new Date(),
        })
        .where(eq(alertHistory.id, alertId));
    }

    console.log(`[DeviceMonitor] Alert created and notification sent: ${title}`);
  } catch (error) {
    console.error("[DeviceMonitor] Failed to send notification:", error);
  }

  return alertId;
}

/**
 * Detect anomalies and trigger alerts
 */
export async function detectAnomalies(
  userId: number,
  deviceStatus: DeviceStatus,
  statusChanged: boolean,
  previousStatus?: string
): Promise<void> {
  // Device stopped
  if (statusChanged && deviceStatus.status === "stopped" && previousStatus === "running") {
    await createAlert(
      userId,
      "device_stopped",
      `デバイス停止: ${deviceStatus.deviceName}`,
      `デバイス「${deviceStatus.deviceName}」(${deviceStatus.deviceId})が停止しました。\n` +
      `前回のステータス: ${previousStatus}\n` +
      `現在のステータス: ${deviceStatus.status}`,
      "high",
      deviceStatus.deviceId
    );
  }

  // Device error
  if (deviceStatus.status === "error") {
    await createAlert(
      userId,
      "device_error",
      `デバイスエラー: ${deviceStatus.deviceName}`,
      `デバイス「${deviceStatus.deviceName}」(${deviceStatus.deviceId})でエラーが発生しました。\n` +
      `エラー内容: ${deviceStatus.errorMessage || "不明なエラー"}`,
      "critical",
      deviceStatus.deviceId
    );
  }

  // Check consecutive errors
  const [monitoringStatus] = await db
    .select()
    .from(deviceMonitoringStatus)
    .where(eq(deviceMonitoringStatus.deviceId, deviceStatus.deviceId))
    .limit(1);

  if (monitoringStatus && monitoringStatus.consecutiveErrors >= 5) {
    await createAlert(
      userId,
      "consecutive_failures",
      `連続エラー検知: ${deviceStatus.deviceName}`,
      `デバイス「${deviceStatus.deviceName}」で${monitoringStatus.consecutiveErrors}回連続でエラーが発生しています。\n` +
      `最後のエラー: ${monitoringStatus.lastErrorMessage || "不明"}`,
      "critical",
      deviceStatus.deviceId
    );
  }
}

/**
 * Run a single monitoring cycle for all devices
 */
export async function runMonitoringCycle(userId: number): Promise<{
  devicesChecked: number;
  alertsTriggered: number;
  errors: string[];
}> {
  const result = {
    devicesChecked: 0,
    alertsTriggered: 0,
    errors: [] as string[],
  };

  try {
    const deviceStatuses = await fetchDeviceStatuses();
    
    for (const deviceStatus of deviceStatuses) {
      try {
        const { statusChanged, previousStatus } = await updateDeviceMonitoringStatus(deviceStatus);
        await detectAnomalies(userId, deviceStatus, statusChanged, previousStatus);
        result.devicesChecked++;
      } catch (error) {
        const errorMsg = `Failed to process device ${deviceStatus.deviceId}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`[DeviceMonitor] ${errorMsg}`);
      }
    }

    // Count alerts triggered in this cycle
    const recentAlerts = await db
      .select()
      .from(alertHistory)
      .where(
        and(
          eq(alertHistory.userId, userId),
          sql`${alertHistory.triggeredAt} > DATE_SUB(NOW(), INTERVAL 1 MINUTE)`
        )
      );
    result.alertsTriggered = recentAlerts.length;

  } catch (error) {
    result.errors.push(`Monitoring cycle failed: ${error}`);
    console.error("[DeviceMonitor] Monitoring cycle failed:", error);
  }

  return result;
}

/**
 * Get device monitoring dashboard data
 */
export async function getMonitoringDashboard(): Promise<{
  devices: any[];
  recentAlerts: any[];
  stats: {
    totalDevices: number;
    runningDevices: number;
    stoppedDevices: number;
    errorDevices: number;
    activeAlerts: number;
  };
}> {
  // Get all device monitoring statuses
  const devices = await db
    .select()
    .from(deviceMonitoringStatus)
    .orderBy(desc(deviceMonitoringStatus.updatedAt));

  // Get recent alerts (last 24 hours)
  const recentAlerts = await db
    .select()
    .from(alertHistory)
    .where(sql`${alertHistory.triggeredAt} > DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(50);

  // Calculate stats
  const stats = {
    totalDevices: devices.length,
    runningDevices: devices.filter((d: any) => d.currentStatus === "running").length,
    stoppedDevices: devices.filter((d: any) => d.currentStatus === "stopped").length,
    errorDevices: devices.filter((d: any) => d.currentStatus === "error").length,
    activeAlerts: recentAlerts.filter((a: any) => a.status === "triggered").length,
  };

  return { devices, recentAlerts, stats };
}

/**
 * Get alert history with pagination
 */
export async function getAlertHistory(
  userId: number,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  return db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.userId, userId))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: number): Promise<void> {
  await db
    .update(alertHistory)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
    })
    .where(eq(alertHistory.id, alertId));
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: number): Promise<void> {
  await db
    .update(alertHistory)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
    })
    .where(eq(alertHistory.id, alertId));
}

/**
 * Get or create default alert settings for a user
 */
export async function getOrCreateAlertSettings(userId: number): Promise<any[]> {
  const existing = await db
    .select()
    .from(alertSettings)
    .where(eq(alertSettings.userId, userId));

  if (existing.length === 0) {
    // Create default settings
    for (const config of DEFAULT_ALERT_CONFIGS) {
      await db.insert(alertSettings).values({
        userId,
        alertType: config.type as any,
        isEnabled: true,
        threshold: config.threshold,
        cooldownMinutes: config.cooldownMinutes,
        notifyOwner: config.notifyOwner,
      });
    }
    
    return db
      .select()
      .from(alertSettings)
      .where(eq(alertSettings.userId, userId));
  }

  return existing;
}

/**
 * Update alert settings
 */
export async function updateAlertSettings(
  userId: number,
  alertType: string,
  settings: {
    isEnabled?: boolean;
    threshold?: number;
    cooldownMinutes?: number;
    notifyOwner?: boolean;
  }
): Promise<void> {
  await db
    .update(alertSettings)
    .set(settings)
    .where(
      and(
        eq(alertSettings.userId, userId),
        eq(alertSettings.alertType, alertType as any)
      )
    );
}
