import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { logger } from '@simple-claude-bot/shared/logger';
import { ZodError } from 'zod';

export function handleError(route: string, error: unknown, errorBody: Record<string, unknown>): HttpResponseInit {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Error';
  const errorCause = error instanceof Error && error.cause ? String(error.cause) : undefined;
  logger.error(`${route} error: ${errorName}: ${errorMessage}`, ...(errorCause ? [{ cause: errorCause }] : []));

  let statusCode = 500;
  if (error instanceof ZodError) {
    statusCode = 400;
  }

  const jsonBody: Record<string, unknown> = { ...errorBody, error: errorMessage };
  if (errorCause) {
    jsonBody.cause = errorCause;
  }

  logger.info('Http Response', { status: statusCode, error: errorName });
  return { status: statusCode, jsonBody };
}

export async function parseJsonBody(request: HttpRequest): Promise<unknown> {
  return request.json();
}
