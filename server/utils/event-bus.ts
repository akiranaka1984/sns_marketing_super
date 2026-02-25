/**
 * WebSocket Event Bus for Real-time Dashboard Updates
 *
 * Provides a pub/sub event system that broadcasts events to connected WebSocket clients.
 * Events are categorized by type (post, engagement, account, analytics, etc.)
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { parse as parseCookieHeader } from 'cookie';
import { COOKIE_NAME } from '@shared/const';
import { sdk } from '../_core/sdk';
import { createLogger } from './logger';

const log = createLogger('event-bus');

export type EventType =
  | 'post:created'
  | 'post:published'
  | 'post:failed'
  | 'engagement:received'
  | 'account:status-changed'
  | 'analytics:updated'
  | 'agent:execution-completed'
  | 'automation:task-completed'
  | 'notification:new';

export type EventPayload = {
  type: EventType;
  data: Record<string, unknown>;
  userId?: number;
  timestamp: string;
};

const WS_EVENTS_PATH = '/ws/events';

// Store clients by userId for targeted delivery
const clientsByUser = new Map<number, Set<WebSocket>>();
let wss: WebSocketServer | null = null;

/**
 * Attach the real-time event WebSocket server to an HTTP server.
 */
export function attachEventBus(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  const originalEmit = server.emit.bind(server);
  const existingHandler = server.emit;

  server.emit = function (event: string, ...args: unknown[]) {
    if (event === 'upgrade') {
      const [request, socket, head] = args as [IncomingMessage, Duplex, Buffer];
      const url = new URL(request.url || '', `http://${request.headers.host}`);

      if (url.pathname === WS_EVENTS_PATH) {
        const cookies = parseCookieHeader(request.headers.cookie || '');
        const sessionCookie = cookies[COOKIE_NAME];

        sdk.verifySession(sessionCookie).then(async (session) => {
          if (!session) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // Get user from DB to get userId
          const { getUserByOpenId } = await import('../db');
          const user = await getUserByOpenId(session.openId);
          if (!user) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          wss!.handleUpgrade(request, socket, head, (ws) => {
            handleEventConnection(ws, user.id);
          });
        }).catch(() => {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        });

        return true;
      }
    }

    return originalEmit(event, ...args);
  } as Server['emit'];

  log.info('Event bus WebSocket server attached');
}

function handleEventConnection(ws: WebSocket, userId: number): void {
  log.info({ userId }, 'Event bus client connected');

  // Add to user's clients
  if (!clientsByUser.has(userId)) {
    clientsByUser.set(userId, new Set());
  }
  clientsByUser.get(userId)!.add(ws);

  // Send welcome event
  sendToClient(ws, {
    type: 'notification:new',
    data: { message: 'connected' },
    timestamp: new Date().toISOString(),
  });

  ws.on('close', () => {
    log.info({ userId }, 'Event bus client disconnected');
    const clients = clientsByUser.get(userId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        clientsByUser.delete(userId);
      }
    }
  });

  ws.on('error', (err) => {
    log.error({ userId, err }, 'Event bus client error');
    const clients = clientsByUser.get(userId);
    if (clients) {
      clients.delete(ws);
    }
  });
}

function sendToClient(ws: WebSocket, payload: EventPayload): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Emit an event to a specific user's connected clients
 */
export function emitToUser(userId: number, type: EventType, data: Record<string, unknown>): void {
  const clients = clientsByUser.get(userId);
  if (!clients || clients.size === 0) return;

  const payload: EventPayload = {
    type,
    data,
    userId,
    timestamp: new Date().toISOString(),
  };

  for (const client of clients) {
    sendToClient(client, payload);
  }
}

/**
 * Emit an event to ALL connected clients (broadcast)
 */
export function emitToAll(type: EventType, data: Record<string, unknown>): void {
  const payload: EventPayload = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  for (const [, clients] of clientsByUser) {
    for (const client of clients) {
      sendToClient(client, payload);
    }
  }
}

/**
 * Get count of connected clients
 */
export function getConnectedClientsCount(): number {
  let count = 0;
  for (const [, clients] of clientsByUser) {
    count += clients.size;
  }
  return count;
}
