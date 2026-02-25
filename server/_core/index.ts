import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduledPostsEnqueuer } from "../scheduled-posts";
import { startAutoEngagementExecutor } from "../auto-engagement";
import { getSetting } from "../db";
import uploadRouter from "../upload";
import { startInteractionEnqueuer } from "../interaction-scheduler";
import { registerQueueProcessors } from "../queue-processors";
import { closeQueues } from "../queue-manager";
import { startScheduler } from "../agent-scheduler";
import { attachWebSocketServer } from "../playwright/ws-preview";
import { attachEventBus } from "../utils/event-bus";
import { logger } from "../utils/logger";

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
  logger.info('Loading API keys from database...');

  // Wait for database connection to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const openaiApiKey = await getSetting('OPENAI_API_KEY');

    if (openaiApiKey) {
      process.env.OPENAI_API_KEY = openaiApiKey;
      logger.info('Loaded OPENAI_API_KEY from database');
    } else {
      logger.info('No OPENAI_API_KEY found in database, using environment variable');
    }

    const anthropicApiKey = await getSetting('ANTHROPIC_API_KEY');
    if (anthropicApiKey) {
      process.env.ANTHROPIC_API_KEY = anthropicApiKey;
      logger.info('Loaded ANTHROPIC_API_KEY from database');
    }

    const llmProvider = await getSetting('LLM_PROVIDER');
    if (llmProvider) {
      process.env.LLM_PROVIDER = llmProvider;
      logger.info({ provider: llmProvider }, 'Loaded LLM_PROVIDER from database');
    }
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to load API keys from database');
  }

  const app = express();
  const server = createServer(app);

  // Attach WebSocket server for Playwright live preview
  attachWebSocketServer(server);

  // Attach real-time event bus WebSocket
  attachEventBus(server);

  // Rate limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
  });
  app.use('/api/trpc', generalLimiter);
  app.use('/api/oauth', authLimiter);
  app.use('/api/dev-login', authLimiter);

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
    logger.info({ preferredPort, port }, 'Port busy, using alternative');
  }

  server.listen(port, () => {
    logger.info({ port }, `Server running on http://localhost:${port}/`);

    // Register queue processors (Bull)
    registerQueueProcessors();
    logger.info('Queue processors registered');

    // Start scheduled posts enqueuer (adds pending posts to queue)
    startScheduledPostsEnqueuer();

    // Start auto-engagement executor
    startAutoEngagementExecutor();

    // Start interaction enqueuer (adds pending interactions to queue)
    startInteractionEnqueuer();

    // Start agent scheduler (runs scheduled agents automatically)
    startScheduler();
    logger.info('Agent scheduler started');

    logger.info('All background executors started');
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Starting graceful shutdown...');

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close queue connections
      await closeQueues();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason }, 'Unhandled Rejection');
});

startServer().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
