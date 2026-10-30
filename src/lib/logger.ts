/**
 * Centralized logging utility for LogicLot.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   const log = logger('BuyList');
 *   log.info('Loaded vehicles', { count: 42 });
 *   log.error('Failed to save', error);
 *
 * Levels: debug < info < warn < error
 * In production builds the minimum visible level is 'warn'.
 * In development all levels are visible.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const IS_PRODUCTION = import.meta.env.PROD;
const MIN_LEVEL: LogLevel = IS_PRODUCTION ? 'warn' : 'debug';

interface Logger {
  debug: (message: string, ...data: unknown[]) => void;
  info: (message: string, ...data: unknown[]) => void;
  warn: (message: string, ...data: unknown[]) => void;
  error: (message: string, ...data: unknown[]) => void;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatPrefix(module: string, level: LogLevel): string {
  const icons: Record<LogLevel, string> = {
    debug: '🔍',
    info: '✅',
    warn: '⚠️',
    error: '❌',
  };
  return `[${module}] ${icons[level]}`;
}

/**
 * Create a namespaced logger for a module / feature area.
 */
export function logger(module: string): Logger {
  return {
    debug(message: string, ...data: unknown[]) {
      if (!shouldLog('debug')) return;
      console.debug(formatPrefix(module, 'debug'), message, ...data);
    },
    info(message: string, ...data: unknown[]) {
      if (!shouldLog('info')) return;
      console.info(formatPrefix(module, 'info'), message, ...data);
    },
    warn(message: string, ...data: unknown[]) {
      if (!shouldLog('warn')) return;
      console.warn(formatPrefix(module, 'warn'), message, ...data);
    },
    error(message: string, ...data: unknown[]) {
      if (!shouldLog('error')) return;
      console.error(formatPrefix(module, 'error'), message, ...data);
    },
  };
}

/**
 * Extract a human-readable message from an unknown caught value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}
