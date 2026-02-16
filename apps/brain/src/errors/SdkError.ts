import type { ContentfulStatusCode } from 'hono/utils/http-status';

export abstract class SdkError extends Error {
  protected constructor(
    message: string,
    public readonly httpCode: ContentfulStatusCode,
  ) {
    super(message);
  }
}
