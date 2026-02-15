import { SdkError } from './SdkError';

export class ResultErrorError extends SdkError {
  public readonly name: string;

  public constructor(
    subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries',
    public readonly stop_reason: string | null,
    public readonly errors: string[],
  ) {
    super(subtype, 500);
    this.name = 'ResultErrorError';
  }
}
