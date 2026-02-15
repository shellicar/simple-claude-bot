import { SdkError } from './SdkError';

export class UsageLimitError extends SdkError {
  public readonly name: string;

  public constructor(result: string) {
    super(result, 502);
    this.name = 'UsageLimitError';
  }
}
