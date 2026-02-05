/**
 * Playwright browser automation configuration
 */

import path from 'path';

/** Directory for persisted browser session storage state files */
export const SESSION_DIR = path.resolve(process.cwd(), 'data/playwright-sessions');

/** Maximum concurrent browser contexts */
export const MAX_CONCURRENT_BROWSERS = 3;

/** Default navigation timeout (ms) */
export const NAVIGATION_TIMEOUT = 30_000;

/** Default action timeout (ms) */
export const ACTION_TIMEOUT = 15_000;

/** Wait after page navigation (ms) */
export const POST_NAVIGATION_WAIT = 3_000;

/** Wait between UI actions (ms) */
export const INTER_ACTION_DELAY = 1_000;

/** Wait after posting to verify success (ms) */
export const POST_VERIFY_WAIT = 5_000;

/** Default viewport size */
export const VIEWPORT = { width: 1280, height: 800 } as const;

/** X.com selectors */
export const X_SELECTORS = {
  /** Compose tweet button in sidebar */
  composeTweetButton: '[data-testid="SideNav_NewTweet_Button"]',
  /** Tweet text area inside the compose dialog */
  tweetTextArea: '[data-testid="tweetTextArea_0"]',
  /** Inline tweet/post button */
  tweetButton: '[data-testid="tweetButtonInline"]',
  /** File input for media upload */
  mediaInput: '[data-testid="fileInput"]',
  /** Toast notification container (success feedback) */
  toast: '[data-testid="toast"]',
  /** Login form username input */
  loginUsernameInput: 'input[autocomplete="username"]',
  /** Login form password input */
  loginPasswordInput: 'input[autocomplete="current-password"]',
  /** Login next button */
  loginNextButton: '[role="button"]:has-text("Next")',
  /** Login submit button */
  loginSubmitButton: '[data-testid="LoginForm_Login_Button"]',
  /** Profile avatar (indicates logged-in state) */
  profileAvatar: '[data-testid="AppTabBar_Profile_Link"]',

  // ============================================
  // Engagement Action Selectors
  // ============================================

  /** Like button on a tweet (not yet liked) */
  likeButton: '[data-testid="like"]',
  /** Unlike button on a tweet (already liked) */
  unlikeButton: '[data-testid="unlike"]',
  /** Reply button on a tweet */
  replyButton: '[data-testid="reply"]',
  /** Retweet button on a tweet */
  retweetButton: '[data-testid="retweet"]',
  /** Unretweet button (already retweeted) */
  unretweetButton: '[data-testid="unretweet"]',
  /** Confirm retweet option in the menu */
  retweetConfirm: '[data-testid="retweetConfirm"]',
  /** Quote tweet option in the menu */
  quoteButton: '[data-testid="Retweet"]',
  /** Follow button on user profile */
  followButton: '[data-testid="follow"]',
  /** Unfollow button on user profile */
  unfollowButton: '[data-testid="unfollow"]',
  /** Confirm unfollow button in the modal */
  unfollowConfirm: '[data-testid="confirmationSheetConfirm"]',
  /** Reply text area in reply dialog */
  replyTextArea: '[data-testid="tweetTextarea_0"]',
  /** Reply submit button */
  replySubmitButton: '[data-testid="tweetButton"]',
  /** Tweet article container */
  tweetArticle: 'article[data-testid="tweet"]',
  /** User cell (in followers/following list) */
  userCell: '[data-testid="UserCell"]',
  /** Primary column (main content area) */
  primaryColumn: '[data-testid="primaryColumn"]',
} as const;

/** X.com URLs */
export const X_URLS = {
  home: 'https://x.com/home',
  login: 'https://x.com/i/flow/login',
  compose: 'https://x.com/compose/post',
} as const;
