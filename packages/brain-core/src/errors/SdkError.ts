export abstract class SdkError extends Error {
  protected constructor(
    message: string,
    public readonly httpCode: number,
  ) {
    super(message);
  }
}
