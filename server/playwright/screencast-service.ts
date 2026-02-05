/**
 * Screencast Service
 *
 * Manages CDP Page.startScreencast sessions for Playwright pages.
 * Captures JPEG frames from the browser and distributes them to listeners.
 */

import type { Page, CDPSession } from 'playwright';

export type FrameListener = (frame: Buffer) => void;

export interface OperationStatus {
  operation: string;
  step?: string;
  timestamp: number;
}

interface ScreencastSession {
  accountId: number;
  cdpSession: CDPSession;
  listeners: Set<FrameListener>;
  operationStatus?: OperationStatus;
}

const activeSessions = new Map<number, ScreencastSession>();

// Listeners registered before screencast starts (WebSocket connects before mutation runs)
const pendingListeners = new Map<number, Set<FrameListener>>();

/**
 * Start screencast for a given account's page.
 * Captures JPEG frames via CDP and distributes to registered listeners.
 */
export async function startScreencast(
  accountId: number,
  page: Page,
  options?: { quality?: number; maxWidth?: number; maxHeight?: number }
): Promise<void> {
  // Stop any existing screencast for this account
  await stopScreencast(accountId);

  const quality = options?.quality ?? 60;
  const maxWidth = options?.maxWidth ?? 1280;
  const maxHeight = options?.maxHeight ?? 800;

  try {
    const cdpSession = await page.context().newCDPSession(page);

    // Pick up any listeners registered before screencast started
    const pending = pendingListeners.get(accountId);
    const session: ScreencastSession = {
      accountId,
      cdpSession,
      listeners: pending ?? new Set(),
    };
    pendingListeners.delete(accountId);

    activeSessions.set(accountId, session);

    // Listen for screencast frames
    cdpSession.on('Page.screencastFrame', (params: { data: string; sessionId: number; metadata: unknown }) => {
      const currentSession = activeSessions.get(accountId);
      if (!currentSession) return;

      // Acknowledge the frame to keep receiving new ones
      cdpSession.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});

      // Convert base64 frame to Buffer and distribute to listeners
      const frameBuffer = Buffer.from(params.data, 'base64');
      for (const listener of currentSession.listeners) {
        try {
          listener(frameBuffer);
        } catch {
          // Ignore listener errors
        }
      }
    });

    // Start the screencast
    await cdpSession.send('Page.startScreencast', {
      format: 'jpeg',
      quality,
      maxWidth,
      maxHeight,
      everyNthFrame: 1,
    });

    console.log(`[Screencast] Started for account ${accountId}`);
  } catch (err: any) {
    console.error(`[Screencast] Failed to start for account ${accountId}:`, err.message);
    activeSessions.delete(accountId);
  }
}

/**
 * Stop screencast for a given account.
 */
export async function stopScreencast(accountId: number): Promise<void> {
  const session = activeSessions.get(accountId);
  if (!session) return;

  try {
    await session.cdpSession.send('Page.stopScreencast');
    await session.cdpSession.detach();
  } catch {
    // CDP session may already be closed
  }

  session.listeners.clear();
  activeSessions.delete(accountId);
  console.log(`[Screencast] Stopped for account ${accountId}`);
}

/**
 * Add a frame listener for a given account's screencast.
 */
export function addFrameListener(accountId: number, listener: FrameListener): void {
  const session = activeSessions.get(accountId);
  if (session) {
    session.listeners.add(listener);
  } else {
    // Store as pending — will be picked up when startScreencast is called
    if (!pendingListeners.has(accountId)) {
      pendingListeners.set(accountId, new Set());
    }
    pendingListeners.get(accountId)!.add(listener);
  }
}

/**
 * Remove a frame listener for a given account's screencast.
 */
export function removeFrameListener(accountId: number, listener: FrameListener): void {
  const session = activeSessions.get(accountId);
  if (session) {
    session.listeners.delete(listener);
  }
  const pending = pendingListeners.get(accountId);
  if (pending) {
    pending.delete(listener);
    if (pending.size === 0) {
      pendingListeners.delete(accountId);
    }
  }
}

/**
 * Check if screencast is active for a given account.
 */
export function isScreencasting(accountId: number): boolean {
  return activeSessions.has(accountId);
}

/**
 * Set the current operation status for a given account.
 * This is sent to connected WebSocket clients as a JSON status message.
 */
export function setOperationStatus(accountId: number, operation: string, step?: string): void {
  const session = activeSessions.get(accountId);
  if (session) {
    session.operationStatus = { operation, step, timestamp: Date.now() };
  }
}

/**
 * Get the current operation status for a given account.
 */
export function getOperationStatus(accountId: number): OperationStatus | undefined {
  return activeSessions.get(accountId)?.operationStatus;
}
