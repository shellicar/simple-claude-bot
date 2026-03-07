import type { HttpHandler } from '@azure/functions';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { earsApp } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    const requestId = request.params.requestId;
    if (!requestId) {
      return { status: 400, jsonBody: null };
    }
    const body = await parseJsonBody(request);
    const result = await earsApp.handleCallback(requestId, body);
    return {
      status: result.status,
      jsonBody: result.body,
    };
  } catch (error) {
    return handleError('/callback', error, {});
  }
};
