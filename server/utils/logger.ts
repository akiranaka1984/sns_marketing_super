/**
 * Structured Logger using Pino
 *
 * Replaces console.log with structured JSON logging.
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.info({ accountId: 1 }, 'Account created');
 *   logger.error({ err }, 'Failed to process');
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with a specific module name.
 * Returns a wrapper that supports console.log-style calls:
 *   logger.info("message", arg1, arg2)  // like console.log
 *   logger.error("message", error)      // error object as extra arg
 *   logger.info({ key: "val" }, "msg")  // native pino style also works
 */
export function createLogger(module: string) {
  const child = logger.child({ module });

  function wrap(level: 'info' | 'warn' | 'error' | 'debug' | 'fatal' | 'trace') {
    return (...args: unknown[]) => {
      if (args.length === 0) {
        child[level]('');
      } else if (args.length === 1) {
        const a = args[0];
        if (typeof a === 'string') {
          child[level](a);
        } else if (typeof a === 'object' && a !== null) {
          child[level](a as object, '');
        } else {
          child[level](String(a));
        }
      } else {
        const first = args[0];
        if (typeof first === 'object' && first !== null && !(first instanceof Error) && typeof args[1] === 'string') {
          // Native pino style: logger.info({ key: val }, "message")
          child[level](first as object, args[1] as string);
        } else {
          // Console.log style: logger.info("message", arg1, arg2)
          const msg = args.map(a => {
            if (a instanceof Error) return a.message;
            if (typeof a === 'string') return a;
            if (a instanceof Date) return a.toISOString();
            try { return JSON.stringify(a); } catch { return String(a); }
          }).join(' ');
          child[level](msg);
        }
      }
    };
  }

  return {
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    debug: wrap('debug'),
    fatal: wrap('fatal'),
    trace: wrap('trace'),
    child: child.child.bind(child),
  };
}
