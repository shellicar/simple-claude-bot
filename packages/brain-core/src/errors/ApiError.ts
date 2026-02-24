import { SdkError } from './SdkError';

const KNOWN_STATUS_CODES: ReadonlySet<number> = new Set([400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 429, 500, 501, 502, 503, 504]);

function toHttpCode(apiStatusCode: number): number {
  if (KNOWN_STATUS_CODES.has(apiStatusCode)) {
    return apiStatusCode;
  }
  return 500;
}

export class ApiError extends SdkError {
  public readonly name: string;

  public constructor(
    apiStatusCode: number,
    public readonly errorType: string | null,
    public readonly errorMessage: string | null,
  ) {
    super(errorMessage ?? `API Error: ${apiStatusCode}`, toHttpCode(apiStatusCode));
    this.name = 'ApiError';
  }
}
