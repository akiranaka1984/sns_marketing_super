/**
 * Regenerate scheduled posts for an agent
 * Usage: npx tsx scripts/regenerate-posts.ts
 */

import "dotenv/config";
import { getSetting } from "../server/db";
import { generateScheduledPosts } from "../server/agent-scheduled-posts";

async function loadApiKeys() {
  console.log("Loading API keys from database...");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    const openaiApiKey = await getSetting("OPENAI_API_KEY");
    if (openaiApiKey) {
      process.env.OPENAI_API_KEY = openaiApiKey;
      console.log("✅ Loaded OPENAI_API_KEY from database");
    } else {
      console.log("⚠️  No OPENAI_API_KEY found in database");
    }
  } catch (error: any) {
    console.error("Failed to load API keys:", error.message);
  }
}

async function main() {
  await loadApiKeys();

  const agentId = 1; // TrendSeeker
  const count = 5;

  console.log(`Generating ${count} scheduled posts for agent ${agentId}...`);

  try {
    const result = await generateScheduledPosts(agentId, count);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

main();
