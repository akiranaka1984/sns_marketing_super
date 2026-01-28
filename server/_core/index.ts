import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { deviceStatusUpdater } from "../device-status-updater";
import { startScheduledPostsEnqueuer } from "../scheduled-posts";
import { startAutoEngagementExecutor } from "../auto-engagement";
import { getSetting } from "../db";
import { startProxyHealthMonitor } from "../duoplus-proxy-health";
import uploadRouter from "../upload";
import { startInteractionEnqueuer } from "../interaction-scheduler";
import { registerQueueProcessors } from "../queue-processors";
import { closeQueues } from "../queue-manager";
import { startScheduler } from "../agent-scheduler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Load API keys from database on startup
  console.log('[Settings] Loading API keys from database...');
  
  // Wait for database connection to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const duoplusApiKey = await getSetting('DUOPLUS_API_KEY');
    const openaiApiKey = await getSetting('OPENAI_API_KEY');
    
    console.log('[Settings] Database query results:', {
      duoplusApiKey: duoplusApiKey ? `${duoplusApiKey.substring(0, 20)}...` : 'null',
      openaiApiKey: openaiApiKey ? `${openaiApiKey.substring(0, 20)}...` : 'null',
    });
    
    if (duoplusApiKey) {
      const oldKey = process.env.DUOPLUS_API_KEY;
      process.env.DUOPLUS_API_KEY = duoplusApiKey;
      console.log('[Settings] ✅ Loaded DUOPLUS_API_KEY from database');
      console.log(`[Settings]    Old: ${oldKey?.substring(0, 20)}...`);
      console.log(`[Settings]    New: ${duoplusApiKey.substring(0, 20)}...`);
    } else {
      console.log('[Settings] ⚠️  No DUOPLUS_API_KEY found in database, using environment variable');
    }
    
    if (openaiApiKey) {
      process.env.OPENAI_API_KEY = openaiApiKey;
      console.log('[Settings] ✅ Loaded OPENAI_API_KEY from database');
    } else {
      console.log('[Settings] ⚠️  No OPENAI_API_KEY found in database, using environment variable');
    }
  } catch (error: any) {
    console.error('[Settings] ❌ Failed to load API keys from database:', error.message);
    console.error('[Settings] Stack trace:', error.stack);
  }
  
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // File upload API
  app.use("/api", uploadRouter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start device status background updater
    deviceStatusUpdater.start();

    // Register queue processors (Bull)
    registerQueueProcessors();
    console.log('[Queue] Queue processors registered');

    // Start scheduled posts enqueuer (adds pending posts to queue)
    startScheduledPostsEnqueuer();

    // Start auto-engagement executor
    startAutoEngagementExecutor();

    // Start proxy health monitor
    startProxyHealthMonitor();

    // Start interaction enqueuer (adds pending interactions to queue)
    startInteractionEnqueuer();

    // Start agent scheduler (runs scheduled agents automatically)
    startScheduler();
    console.log('[AgentScheduler] Agent scheduler started');

    console.log('[Automation] All background executors started');
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log('[Server] HTTP server closed');

      // Close queue connections
      await closeQueues();

      // Stop device updater
      deviceStatusUpdater.stop();

      console.log('[Server] Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  console.error('[FATAL] Stack:', error.stack);
  // Log but don't exit immediately to allow graceful shutdown
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise);
  console.error('[FATAL] Reason:', reason);
});

startServer().catch((error) => {
  console.error('[FATAL] Failed to start server:', error);
  process.exit(1);
});
