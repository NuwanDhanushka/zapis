export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toSafeError(error: unknown): Error {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new Error(error.message);
  }

  return new Error("Unexpected application error.");
}
