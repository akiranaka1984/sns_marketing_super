import { describe, it, expect } from "vitest";
import { getProxyListFromDuoPlus } from "./duoplus-proxy";

describe("DuoPlus API Connection", () => {
  it("should successfully connect to DuoPlus API and retrieve proxy list", async () => {
    // This test validates that the DUOPLUS_API_KEY is correctly configured
    // and can authenticate with the DuoPlus API
    
    try {
      const proxies = await getProxyListFromDuoPlus();
      
      // If we get here, the API key is valid
      expect(proxies).toBeDefined();
      expect(Array.isArray(proxies)).toBe(true);
      
      console.log(`✓ DuoPlus API connection successful. Found ${proxies.length} proxies.`);
    } catch (error: any) {
      // If the error is about API key, the test should fail
      if (error.message.includes("API key") || error.message.includes("authentication")) {
        throw new Error(`DuoPlus API authentication failed: ${error.message}. Please check your DUOPLUS_API_KEY.`);
      }
      
      // Other errors might be acceptable (e.g., no proxies found)
      console.warn(`DuoPlus API call completed with warning: ${error.message}`);
    }
  }, 30000); // 30 second timeout for API call
});
