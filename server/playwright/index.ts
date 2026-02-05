/**
 * Playwright browser automation module
 *
 * Re-exports all public APIs for convenient imports.
 */

export {
  acquireContext,
  releaseContext,
  saveSession,
  checkSessionHealth,
  deleteSession,
  shutdownAll,
} from './browser-session-manager';

export { loginToX, ensureLoggedIn } from './x-login-handler';

export { postToXViaPlaywright } from './x-playwright-poster';

export type { LoginResult } from './x-login-handler';
export type { PlaywrightPostResult } from './x-playwright-poster';

export {
  startScreencast,
  stopScreencast,
  isScreencasting,
  setOperationStatus,
  getOperationStatus,
} from './screencast-service';

export { attachWebSocketServer } from './ws-preview';
