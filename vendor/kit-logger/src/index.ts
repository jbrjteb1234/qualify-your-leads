export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(event: string, payload?: Record<string, unknown>): void;
  info(event: string, payload?: Record<string, unknown>): void;
  warn(event: string, payload?: Record<string, unknown>): void;
  error(event: string, payload?: Record<string, unknown>): void;
}

function emit(
  level: LogLevel,
  component: string,
  event: string,
  payload?: Record<string, unknown>
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component,
    event,
    ...payload,
  });
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export function createLogger(component: string): Logger {
  return {
    debug: (event, payload) => emit("debug", component, event, payload),
    info: (event, payload) => emit("info", component, event, payload),
    warn: (event, payload) => emit("warn", component, event, payload),
    error: (event, payload) => emit("error", component, event, payload),
  };
}
