import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
  ),
  transports: [new transports.Console()],
});
