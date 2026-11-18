import { env, isProduction } from '../config/env';

type LogFn = (objOrMsg: unknown, msg?: string) => void;

export interface Logger {
  fatal: LogFn;
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
  trace: LogFn;
}

const silent = env.NODE_ENV === 'test';

function formatLog(level: string, objOrMsg: unknown, msg?: string): string {
  const time = new Date().toISOString();
  if (typeof objOrMsg === 'string') {
    return isProduction
      ? JSON.stringify({ level, time, service: 'obra-rent-api', msg: objOrMsg })
      : `[${time.slice(11, 19)}] ${level.toUpperCase()}: ${objOrMsg}`;
  }
  if (objOrMsg && typeof objOrMsg === 'object') {
    const raw = objOrMsg as Record<string, unknown>;
    const serialized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v instanceof Error) {
        serialized[k] = { type: v.name, message: v.message, stack: v.stack };
      } else {
        serialized[k] = v;
      }
    }
    return isProduction
      ? JSON.stringify({ level, time, service: 'obra-rent-api', ...serialized, msg: msg ?? '' })
      : `[${time.slice(11, 19)}] ${level.toUpperCase()}: ${msg ?? ''} ${JSON.stringify(serialized)}`;
  }
  return `[${time.slice(11, 19)}] ${level.toUpperCase()}: ${String(msg ?? objOrMsg)}`;
}

export const logger: Logger = {
  fatal(objOrMsg, msg) {
    if (!silent) console.error(formatLog('fatal', objOrMsg, msg));
  },
  error(objOrMsg, msg) {
    if (!silent) console.error(formatLog('error', objOrMsg, msg));
  },
  warn(objOrMsg, msg) {
    if (!silent) console.warn(formatLog('warn', objOrMsg, msg));
  },
  info(objOrMsg, msg) {
    if (!silent) console.log(formatLog('info', objOrMsg, msg));
  },
  debug(objOrMsg, msg) {
    if (!silent && env.LOG_LEVEL === 'debug') console.log(formatLog('debug', objOrMsg, msg));
  },
  trace(objOrMsg, msg) {
    if (!silent && env.LOG_LEVEL === 'trace') console.log(formatLog('trace', objOrMsg, msg));
  },
};
