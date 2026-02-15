import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'HH:mm:ss.SSS' }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level}: ${message}${metaStr}`;
    }),
  ),
  transports: [new transports.Console()],
});
