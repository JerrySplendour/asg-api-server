type LogMethod = (message: unknown, ...optionalParams: unknown[]) => void;

interface LoggerLike {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
}

const formatLogEntry = (level: string, message: unknown, optionalParams: unknown[]) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}]`;

  if (typeof message === 'string' && optionalParams.length === 0) {
    console.log(`${base} ${message}`);
    return;
  }

  if (typeof message === 'string' && optionalParams.length > 0) {
    console.log(`${base} ${message}`, ...optionalParams);
    return;
  }

  console.log(base, message, ...optionalParams);
};

export const logger: LoggerLike = {
  info: (message, ...optionalParams) => formatLogEntry('info', message, optionalParams),
  warn: (message, ...optionalParams) => formatLogEntry('warn', message, optionalParams),
  error: (message, ...optionalParams) => formatLogEntry('error', message, optionalParams),
  debug: (message, ...optionalParams) => formatLogEntry('debug', message, optionalParams),
};
