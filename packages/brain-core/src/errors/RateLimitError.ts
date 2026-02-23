import { SdkError } from './SdkError';

export class RateLimitError extends SdkError {
  public readonly name: string;

  public constructor(result: string) {
    super(result, 429);
    this.name = 'RateLimitError';
  }
}
