const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
const level = (process.env.LOG_LEVEL as keyof typeof LEVELS) ?? "info";

function log(lvl: keyof typeof LEVELS, msg: string, data?: Record<string, unknown>) {
  if (LEVELS[lvl] < LEVELS[level]) return;
  const entry = { ts: new Date().toISOString(), level: lvl, msg, ...data };
  process.stderr.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
