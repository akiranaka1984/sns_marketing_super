/**
 * Fix pino logger signature mismatches.
 * Pino requires: logger.method(mergingObject, message) or logger.method(message)
 * NOT: logger.method(message, extraArg)
 *
 * This script fixes patterns like:
 *   logger.error("message:", error)  -> logger.error({ err: error }, "message")
 *   logger.warn("message:", error)   -> logger.warn({ err: error }, "message")
 *   logger.info("message:", value)   -> logger.info({ data: value }, "message")
 */

const fs = require('fs');
const path = require('path');

const files = [
  'server/_core/notification.ts',
  'server/_core/oauth.ts',
  'server/_core/sdk.ts',
  'server/ai-comment-service.ts',
  'server/ai-optimization.routers.ts',
  'server/buzz-analysis.routers.ts',
  'server/engagement-collector.routers.ts',
  'server/interaction-scheduler.ts',
  'server/interaction-settings.routers.ts',
  'server/playwright/browser-session-manager.ts',
  'server/playwright/ws-preview.ts',
  'server/post-success-hook.ts',
  'server/projects.routers.ts',
  'server/services/account-learning-service.ts',
  'server/services/account-recovery-scheduler.ts',
  'server/services/auto-optimization-scheduler.ts',
  'server/services/buzz-analyzer.ts',
  'server/services/buzz-detection-scheduler.ts',
  'server/services/category-classifier.ts',
  'server/services/engagement-queue.ts',
  'server/services/learning-sync-service.ts',
  'server/services/learning-trigger-service.ts',
  'server/services/performance-tracking-scheduler.ts',
  'server/services/profile-optimizer.ts',
  'server/services/target-discovery.ts',
  'server/settings.routers.ts',
  'server/upload.ts',
  'server/utils/python-runner.ts',
  'server/weekly-review.routers.ts',
];

const rootDir = path.resolve(__dirname, '..');

let totalFixes = 0;

for (const relPath of files) {
  const filePath = path.join(rootDir, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let fixes = 0;

  // Pattern 1: Single-line logger.error/warn/info("string", variable) on one line
  // Match: logger.(error|warn|info)( <quote>...<quote> , <variable> )
  // We need to handle both single-quote and backtick strings, and template literals

  // This regex matches logger calls where:
  // - First arg is a string literal (single-quoted, double-quoted, or backtick)
  // - Second arg is a variable/expression (not a string literal)
  // - All on one line

  const singleLineRegex = /logger\.(error|warn|info)\((\s*)(["'`])((?:[^\\]|\\.)*?)\3(\s*),(\s*)([^)]+)\)/g;

  content = content.replace(singleLineRegex, (match, level, ws1, quote, msgContent, ws2, ws3, secondArg) => {
    // Check if secondArg is already an object literal starting with {
    // If so, we just need to swap: logger.info({...}, "message")
    secondArg = secondArg.trim();

    // Skip if this is already in correct pino format (first arg is object)
    // This shouldn't match our regex since first arg must be a string

    // Clean up message: remove trailing colon/space
    let cleanMsg = msgContent.replace(/[:\s]+$/, '');

    // Determine the object key based on level and variable name
    let objKey;
    if (level === 'error' || level === 'warn') {
      // For error/warn, use 'err' key for error objects
      if (secondArg.match(/^(error|err|e|applyError|autoApplyError)\b/i)) {
        objKey = 'err';
      } else {
        objKey = 'data';
      }
    } else {
      objKey = 'data';
    }

    // If secondArg is already an object literal { ... }, use it directly as merge object
    if (secondArg.startsWith('{')) {
      fixes++;
      return `logger.${level}(${secondArg}, ${quote}${cleanMsg}${quote})`;
    }

    // If secondArg is a property access like err.message, use 'data' or 'err'
    fixes++;
    return `logger.${level}({ ${objKey}: ${secondArg} }, ${quote}${cleanMsg}${quote})`;
  });

  // Pattern 2: Multi-line logger calls where the string spans lines then has a second arg
  // e.g.:
  //   logger.error(
  //     `[Module] message ${var}:`,
  //     error
  //   );
  // These need more careful handling

  const multiLineRegex = /logger\.(error|warn|info)\(\s*\n(\s*)(["'`])((?:[^\\]|\\.|\n)*?)\3\s*,\s*\n\s*(\w[\w.]*)\s*\n\s*\)/g;

  content = content.replace(multiLineRegex, (match, level, indent, quote, msgContent, secondArg) => {
    let cleanMsg = msgContent.replace(/[:\s]+$/, '');

    let objKey;
    if (level === 'error' || level === 'warn') {
      if (secondArg.match(/^(error|err|e|applyError|autoApplyError)\b/i)) {
        objKey = 'err';
      } else {
        objKey = 'data';
      }
    } else {
      objKey = 'data';
    }

    fixes++;
    return `logger.${level}({ ${objKey}: ${secondArg} },\n${indent}${quote}${cleanMsg}${quote}\n${indent.replace('  ', '')})`;
  });

  if (fixes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`FIXED ${fixes} calls in ${relPath}`);
    totalFixes += fixes;
  } else {
    console.log(`NO MATCHES in ${relPath}`);
  }
}

console.log(`\nTotal fixes: ${totalFixes}`);
