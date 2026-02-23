import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { SdkError } from '@simple-claude-bot/brain-core/errors/SdkError';
import { logger } from '@simple-claude-bot/shared/logger';
import { ZodError } from 'zod';

export function handleError(route: string, error: unknown, errorBody: Record<string, unknown>): HttpResponseInit {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Error';

  logger.error(`${route} error: ${errorName}: ${errorMessage}`);

  let statusCode = 500;
  if (error instanceof ZodError) {
    statusCode = 400;
  } else if (error instanceof SdkError) {
    statusCode = error.httpCode;
  }

  logger.info('Http Response', { status: statusCode, error: errorName });
  return {
    status: statusCode,
    jsonBody: { ...errorBody, error: errorMessage },
  };
}

export async function parseJsonBody(request: HttpRequest): Promise<unknown> {
  return request.json();
}
