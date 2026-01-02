import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchDeviceStatuses,
  updateDeviceMonitoringStatus,
  shouldTriggerAlert,
  createAlert,
  detectAnomalies,
  runMonitoringCycle,
  getMonitoringDashboard,
  getAlertHistory,
  acknowledgeAlert,
  resolveAlert,
  getOrCreateAlertSettings,
  updateAlertSettings,
} from "./device-monitor";

// Mock dependencies
vi.mock("./duoplus", () => ({
  listDevices: vi.fn().mockResolvedValue([
    { id: "device1", name: "Test Device 1", status: 1, ip: "192.168.1.1", os: "Android 12" },
    { id: "device2", name: "Test Device 2", status: 2, ip: "192.168.1.2", os: "Android 11" },
    { id: "device3", name: "Test Device 3", status: 0, ip: "192.168.1.3", os: "Android 10" },
  ]),
}));

vi.mock("./db", () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve([])),
    [Symbol.asyncIterator]: async function* () { yield* []; },
  };
  // Make it thenable to support await
  Object.defineProperty(mockChain, 'then', {
    value: function(resolve: any) { return Promise.resolve([]).then(resolve); },
    writable: true,
  });
  return { db: mockChain };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

describe("Device Monitor Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchDeviceStatuses", () => {
    it("should fetch and map device statuses from DuoPlus API", async () => {
      const statuses = await fetchDeviceStatuses();
      
      expect(statuses).toHaveLength(3);
      expect(statuses[0]).toEqual({
        deviceId: "device1",
        deviceName: "Test Device 1",
        status: "running",
        ipAddress: "192.168.1.1",
        osVersion: "Android 12",
        errorMessage: undefined,
      });
      expect(statuses[1].status).toBe("stopped");
      expect(statuses[2].status).toBe("unknown");
    });
  });

  describe("shouldTriggerAlert", () => {
    it("should return true when no recent alerts exist", async () => {
      const result = await shouldTriggerAlert(1, "device_stopped", "device1");
      expect(result).toBe(true);
    });
  });

  describe("runMonitoringCycle", () => {
    it("should run monitoring cycle and return results", async () => {
      const result = await runMonitoringCycle(1);
      
      expect(result).toHaveProperty("devicesChecked");
      expect(result).toHaveProperty("alertsTriggered");
      expect(result).toHaveProperty("errors");
      expect(result.devicesChecked).toBe(3);
    });
  });

  describe("getMonitoringDashboard", () => {
    it("should return dashboard data with stats", async () => {
      const dashboard = await getMonitoringDashboard();
      
      expect(dashboard).toHaveProperty("devices");
      expect(dashboard).toHaveProperty("recentAlerts");
      expect(dashboard).toHaveProperty("stats");
      expect(dashboard.stats).toHaveProperty("totalDevices");
      expect(dashboard.stats).toHaveProperty("runningDevices");
      expect(dashboard.stats).toHaveProperty("stoppedDevices");
      expect(dashboard.stats).toHaveProperty("errorDevices");
      expect(dashboard.stats).toHaveProperty("activeAlerts");
    });
  });

  describe("getAlertHistory", () => {
    it("should return alert history for user", async () => {
      const history = await getAlertHistory(1, 50, 0);
      
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe("acknowledgeAlert", () => {
    it("should acknowledge an alert", async () => {
      await expect(acknowledgeAlert(1)).resolves.not.toThrow();
    });
  });

  describe("resolveAlert", () => {
    it("should resolve an alert", async () => {
      await expect(resolveAlert(1)).resolves.not.toThrow();
    });
  });

  describe("getOrCreateAlertSettings", () => {
    it("should return alert settings for user", async () => {
      const settings = await getOrCreateAlertSettings(1);
      
      expect(Array.isArray(settings)).toBe(true);
    });
  });

  describe("updateAlertSettings", () => {
    it("should update alert settings", async () => {
      await expect(
        updateAlertSettings(1, "device_stopped", { isEnabled: false })
      ).resolves.not.toThrow();
    });
  });
});
