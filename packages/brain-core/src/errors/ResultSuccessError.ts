import { SdkError } from './SdkError';

export class ResultSuccessError extends SdkError {
  public readonly name: string;

  public constructor(
    result: string,
    public readonly stop_reason: string | null,
  ) {
    super(result, 500);
    this.name = 'ResultSuccessError';
  }
}
