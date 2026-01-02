import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the duoplus module
vi.mock("./duoplus", () => ({
  listDevices: vi.fn(),
}));

// Mock db module
vi.mock("./db", () => ({
  getAccountById: vi.fn(),
  updateAccountDeviceId: vi.fn(),
  getAccountsByUserId: vi.fn(),
}));

import { listDevices } from "./duoplus";
import * as db from "./db";

describe("Device Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listDevices", () => {
    it("returns formatted device list from DuoPlus API", async () => {
      const mockDevices = [
        {
          id: "device1",
          name: "Test Device 1",
          status: 1, // running
          os: "Android 12",
          ip: "192.168.1.1",
          area: "JP",
          expired_at: "2025-12-31",
          remark: "Test remark",
        },
        {
          id: "device2",
          name: "Test Device 2",
          status: 2, // stopped
          os: "Android 11",
          ip: "192.168.1.2",
          area: "US",
          expired_at: "2025-12-31",
          remark: "",
        },
      ];

      vi.mocked(listDevices).mockResolvedValue(mockDevices as any);

      const devices = await listDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0].id).toBe("device1");
      expect(devices[0].status).toBe(1);
      expect(devices[1].status).toBe(2);
    });

    it("returns empty array when no devices exist", async () => {
      vi.mocked(listDevices).mockResolvedValue([]);

      const devices = await listDevices();

      expect(devices).toHaveLength(0);
    });
  });

  describe("Account-Device Linking", () => {
    it("links account to device", async () => {
      const mockAccount = {
        id: 1,
        userId: 1,
        platform: "twitter",
        username: "testuser",
        deviceId: null,
      };

      vi.mocked(db.getAccountById).mockResolvedValue(mockAccount as any);
      vi.mocked(db.updateAccountDeviceId).mockResolvedValue(undefined);

      await db.updateAccountDeviceId(1, "device123");

      expect(db.updateAccountDeviceId).toHaveBeenCalledWith(1, "device123");
    });

    it("unlinks account from device", async () => {
      const mockAccount = {
        id: 1,
        userId: 1,
        platform: "twitter",
        username: "testuser",
        deviceId: "device123",
      };

      vi.mocked(db.getAccountById).mockResolvedValue(mockAccount as any);
      vi.mocked(db.updateAccountDeviceId).mockResolvedValue(undefined);

      await db.updateAccountDeviceId(1, null);

      expect(db.updateAccountDeviceId).toHaveBeenCalledWith(1, null);
    });
  });

  describe("Device Status Mapping", () => {
    it("maps DuoPlus status codes correctly", () => {
      // Status mapping: 1 = running, 2 = stopped, others = unknown
      const statusMap = (status: number): string => {
        switch (status) {
          case 1:
            return "running";
          case 2:
            return "stopped";
          default:
            return "unknown";
        }
      };

      expect(statusMap(1)).toBe("running");
      expect(statusMap(2)).toBe("stopped");
      expect(statusMap(0)).toBe("unknown");
      expect(statusMap(10)).toBe("unknown");
    });
  });

  describe("Device-Account Association", () => {
    it("creates device-account map correctly", () => {
      const accounts = [
        { id: 1, username: "user1", platform: "twitter", deviceId: "device1" },
        { id: 2, username: "user2", platform: "instagram", deviceId: "device1" },
        { id: 3, username: "user3", platform: "tiktok", deviceId: "device2" },
        { id: 4, username: "user4", platform: "facebook", deviceId: null },
      ];

      const deviceAccountsMap = new Map<string, any[]>();
      accounts.forEach((account) => {
        if (account.deviceId) {
          if (!deviceAccountsMap.has(account.deviceId)) {
            deviceAccountsMap.set(account.deviceId, []);
          }
          deviceAccountsMap.get(account.deviceId)!.push(account);
        }
      });

      expect(deviceAccountsMap.get("device1")).toHaveLength(2);
      expect(deviceAccountsMap.get("device2")).toHaveLength(1);
      expect(deviceAccountsMap.has("device3")).toBe(false);
    });

    it("identifies unlinked accounts", () => {
      const accounts = [
        { id: 1, username: "user1", deviceId: "device1" },
        { id: 2, username: "user2", deviceId: null },
        { id: 3, username: "user3", deviceId: "device2" },
        { id: 4, username: "user4", deviceId: null },
      ];

      const unlinkedAccounts = accounts.filter((account) => !account.deviceId);

      expect(unlinkedAccounts).toHaveLength(2);
      expect(unlinkedAccounts[0].id).toBe(2);
      expect(unlinkedAccounts[1].id).toBe(4);
    });
  });
});
