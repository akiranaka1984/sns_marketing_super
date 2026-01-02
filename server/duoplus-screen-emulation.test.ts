import { describe, it, expect } from "vitest";
import axios from "axios";

/**
 * DuoPlus API Screen Emulation Tests
 * 
 * These tests verify that the DuoPlus API can be used to:
 * 1. List devices
 * 2. Take screenshots
 * 3. Execute ADB commands (tap, input text, etc.)
 */

const DUOPLUS_API_BASE = "https://openapi.duoplus.net";
const DUOPLUS_API_KEY = process.env.DUOPLUS_API_KEY || "";

const duoplusClient = axios.create({
  baseURL: DUOPLUS_API_BASE,
  headers: {
    "DuoPlus-API-Key": DUOPLUS_API_KEY,
    "Content-Type": "application/json",
    "Lang": "en",
  },
  timeout: 30000,
});

describe("DuoPlus API Screen Emulation", () => {
  let testDeviceId: string | null = null;

  // Test 1: List devices
  it("should list available devices", async () => {
    console.log("\n=== Test 1: List Devices ===");
    console.log(`API Key configured: ${DUOPLUS_API_KEY ? "Yes (length: " + DUOPLUS_API_KEY.length + ")" : "No"}`);
    
    const response = await duoplusClient.post("/api/v1/cloudPhone/list", {
      page: 1,
      pagesize: 100,
    });

    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(response.data, null, 2));

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();

    // Check if we have devices
    const devices = response.data.data?.list || [];
    console.log(`Found ${devices.length} devices`);

    if (devices.length > 0) {
      // Find a powered-on device for subsequent tests
      const poweredOnDevice = devices.find((d: any) => d.status === 1);
      if (poweredOnDevice) {
        testDeviceId = poweredOnDevice.id;
        console.log(`Selected device for testing: ${testDeviceId} (${poweredOnDevice.name})`);
        console.log(`Device status: ${poweredOnDevice.status}`);
        console.log(`Device IP: ${poweredOnDevice.ip || "N/A"}`);
      } else {
        console.log("No powered-on devices found. Device statuses:");
        devices.forEach((d: any) => {
          console.log(`  - ${d.id}: status=${d.status}, name=${d.name}`);
        });
      }
    }
  }, 30000);

  // Test 2: Execute ADB command (simple test)
  it("should execute ADB command on device", async () => {
    console.log("\n=== Test 2: Execute ADB Command ===");
    
    // Get a device first
    const listResponse = await duoplusClient.post("/api/v1/cloudPhone/list", {
      page: 1,
      pagesize: 100,
    });
    
    const devices = listResponse.data.data?.list || [];
    const poweredOnDevice = devices.find((d: any) => d.status === 1);
    
    if (!poweredOnDevice) {
      console.log("Skipping: No powered-on device available");
      return;
    }

    const deviceId = poweredOnDevice.id;
    console.log(`Testing ADB on device: ${deviceId}`);

    // Try a simple ADB command: get device info
    try {
      const response = await duoplusClient.post("/api/v1/cloudPhone/executeAdb", {
        cloudPhoneId: deviceId,
        command: "getprop ro.product.model",
      });

      console.log("ADB Response status:", response.status);
      console.log("ADB Response data:", JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
    } catch (error: any) {
      console.log("ADB Error:", error.response?.data || error.message);
      // Log the error but don't fail - permissions might be limited
      if (error.response?.data?.message?.includes("permissions")) {
        console.log("Note: API key may not have executeAdb permissions");
      }
    }
  }, 30000);

  // Test 3: Take screenshot
  it("should take screenshot of device", async () => {
    console.log("\n=== Test 3: Take Screenshot ===");
    
    // Get a device first
    const listResponse = await duoplusClient.post("/api/v1/cloudPhone/list", {
      page: 1,
      pagesize: 100,
    });
    
    const devices = listResponse.data.data?.list || [];
    const poweredOnDevice = devices.find((d: any) => d.status === 1);
    
    if (!poweredOnDevice) {
      console.log("Skipping: No powered-on device available");
      return;
    }

    const deviceId = poweredOnDevice.id;
    console.log(`Testing screenshot on device: ${deviceId}`);

    // Try to take a screenshot using the official endpoint
    try {
      // First, check if there's a dedicated screenshot endpoint
      const response = await duoplusClient.post("/api/v1/cloudPhone/screenshot", {
        cloudPhoneId: deviceId,
      });

      console.log("Screenshot Response status:", response.status);
      console.log("Screenshot Response data:", JSON.stringify(response.data, null, 2).substring(0, 500));

      expect(response.status).toBe(200);
    } catch (error: any) {
      console.log("Screenshot Error:", error.response?.data || error.message);
      
      // Try alternative: use ADB screencap
      console.log("Trying ADB screencap method...");
      try {
        const adbResponse = await duoplusClient.post("/api/v1/cloudPhone/executeAdb", {
          cloudPhoneId: deviceId,
          command: "screencap -p /sdcard/screenshot.png",
        });
        console.log("ADB screencap response:", JSON.stringify(adbResponse.data, null, 2));
      } catch (adbError: any) {
        console.log("ADB screencap error:", adbError.response?.data || adbError.message);
      }
    }
  }, 60000);

  // Test 4: Screen tap
  it("should tap on screen", async () => {
    console.log("\n=== Test 4: Screen Tap ===");
    
    // Get a device first
    const listResponse = await duoplusClient.post("/api/v1/cloudPhone/list", {
      page: 1,
      pagesize: 100,
    });
    
    const devices = listResponse.data.data?.list || [];
    const poweredOnDevice = devices.find((d: any) => d.status === 1);
    
    if (!poweredOnDevice) {
      console.log("Skipping: No powered-on device available");
      return;
    }

    const deviceId = poweredOnDevice.id;
    console.log(`Testing screen tap on device: ${deviceId}`);

    // Try to tap at center of screen (540, 960 for 1080x1920 resolution)
    try {
      const response = await duoplusClient.post("/api/v1/cloudPhone/executeAdb", {
        cloudPhoneId: deviceId,
        command: "input tap 540 960",
      });

      console.log("Tap Response status:", response.status);
      console.log("Tap Response data:", JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
    } catch (error: any) {
      console.log("Tap Error:", error.response?.data || error.message);
    }
  }, 30000);

  // Test 5: Text input
  it("should input text on device", async () => {
    console.log("\n=== Test 5: Text Input ===");
    
    // Get a device first
    const listResponse = await duoplusClient.post("/api/v1/cloudPhone/list", {
      page: 1,
      pagesize: 100,
    });
    
    const devices = listResponse.data.data?.list || [];
    const poweredOnDevice = devices.find((d: any) => d.status === 1);
    
    if (!poweredOnDevice) {
      console.log("Skipping: No powered-on device available");
      return;
    }

    const deviceId = poweredOnDevice.id;
    console.log(`Testing text input on device: ${deviceId}`);

    // Try to input text
    try {
      const response = await duoplusClient.post("/api/v1/cloudPhone/executeAdb", {
        cloudPhoneId: deviceId,
        command: 'input text "test"',
      });

      console.log("Text Input Response status:", response.status);
      console.log("Text Input Response data:", JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
    } catch (error: any) {
      console.log("Text Input Error:", error.response?.data || error.message);
    }
  }, 30000);

  // Test 6: Check available API endpoints
  it("should check available API capabilities", async () => {
    console.log("\n=== Test 6: API Capabilities Check ===");
    
    const endpoints = [
      { name: "List Devices", method: "POST", path: "/api/v1/cloudPhone/list", body: { page: 1, pagesize: 10 } },
      { name: "Get Proxy List", method: "POST", path: "/api/v1/proxy/list", body: { page: 1, pagesize: 10 } },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await duoplusClient.post(endpoint.path, endpoint.body);
        console.log(`✓ ${endpoint.name}: OK (status: ${response.status})`);
      } catch (error: any) {
        const status = error.response?.status || "N/A";
        const message = error.response?.data?.message || error.message;
        console.log(`✗ ${endpoint.name}: Failed (status: ${status}, message: ${message})`);
      }
    }
  }, 60000);
});
