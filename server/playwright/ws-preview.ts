/**
 * WebSocket Preview Server
 *
 * Provides a WebSocket endpoint at /ws/playwright-preview for streaming
 * Playwright screencast frames to the frontend.
 *
 * Query parameter: accountId (number)
 * Binary messages: JPEG frame data
 * Text messages: JSON status updates { type: 'status', operation, step }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import {
  addFrameListener,
  removeFrameListener,
  isScreencasting,
  getOperationStatus,
  type FrameListener,
} from './screencast-service';

const WS_PATH = '/ws/playwright-preview';

let wss: WebSocketServer | null = null;

/**
 * Attach the WebSocket server to an existing HTTP server.
 *
 * We override `server.emit` so that upgrade events for our path are
 * intercepted before Vite's HMR handler sees them. Without this,
 * both handlers would try to process the same socket, breaking the connection.
 */
export function attachWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  const originalEmit = server.emit.bind(server);

  server.emit = function (event: string, ...args: unknown[]) {
    if (event === 'upgrade') {
      const [request, socket, head] = args as [IncomingMessage, Duplex, Buffer];
      const url = new URL(request.url || '', `http://${request.headers.host}`);

      if (url.pathname === WS_PATH) {
        const accountIdParam = url.searchParams.get('accountId');
        const accountId = accountIdParam ? parseInt(accountIdParam, 10) : NaN;

        if (!isNaN(accountId)) {
          wss!.handleUpgrade(request, socket, head, (ws) => {
            handleConnection(ws, accountId);
          });
        } else {
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
          socket.destroy();
        }

        // Return true — do NOT propagate to Vite HMR or other handlers
        return true;
      }
    }

    return originalEmit(event, ...args);
  } as Server['emit'];

  console.log('[WebSocket] Playwright preview server attached');
}

function handleConnection(ws: WebSocket, accountId: number): void {
  console.log(`[WebSocket] Client connected for account ${accountId}`);

  // Send initial status
  const initialStatus = isScreencasting(accountId) ? 'streaming' : 'idle';
  sendStatus(ws, initialStatus);

  // If there's an active operation status, send it
  const opStatus = getOperationStatus(accountId);
  if (opStatus) {
    sendOperationStatus(ws, opStatus.operation, opStatus.step);
  }

  // Register frame listener
  const frameListener: FrameListener = (frame: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(frame, { binary: true });
    }
  };

  addFrameListener(accountId, frameListener);

  // Poll for status changes
  const statusInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(statusInterval);
      return;
    }

    const currentStatus = isScreencasting(accountId) ? 'streaming' : 'idle';
    sendStatus(ws, currentStatus);

    const currentOpStatus = getOperationStatus(accountId);
    if (currentOpStatus) {
      sendOperationStatus(ws, currentOpStatus.operation, currentOpStatus.step);
    }
  }, 1000);

  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected for account ${accountId}`);
    removeFrameListener(accountId, frameListener);
    clearInterval(statusInterval);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Error for account ${accountId}:`, err.message);
    removeFrameListener(accountId, frameListener);
    clearInterval(statusInterval);
  });
}

function sendStatus(ws: WebSocket, status: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'status', status }));
  }
}

function sendOperationStatus(ws: WebSocket, operation: string, step?: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'operation', operation, step }));
  }
}
