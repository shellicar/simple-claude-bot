import { SdkError } from './SdkError';

export class ApiError extends SdkError {
  public readonly name: string;

  public constructor(
    public readonly apiStatusCode: number,
    public readonly errorType: string | null,
    public readonly errorMessage: string | null,
  ) {
    super(errorMessage ?? `API Error: ${apiStatusCode}`, 502);
    this.name = 'ApiError';
  }
}
