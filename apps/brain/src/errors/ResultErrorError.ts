import { SdkError } from './SdkError';

export class ResultErrorError extends SdkError {
  public readonly name: string;

  public constructor(
    subtype: string,
    public readonly stop_reason: string | null,
    public readonly errors: string[],
  ) {
    super(subtype, 500);
    this.name = 'ResultErrorError';
  }
}
