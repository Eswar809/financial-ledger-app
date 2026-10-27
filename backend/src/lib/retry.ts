export function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    isRetryable?: (error: any) => boolean;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 25;
  const backoffFactor = options.backoffFactor ?? 2;
  const isRetryable =
    options.isRetryable ??
    ((err: any) => {
      const code = err?.code;
      // 40P01 = deadlock_detected, 40001 = serialization_failure, 55P03 = lock_not_available
      return code === '40P01' || code === '40001' || code === '55P03';
    });

  let attempt = 0;
  let delay = initialDelayMs;

  async function execute(): Promise<T> {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (attempt <= maxRetries && isRetryable(err)) {
        // Add full jitter
        const jittered = Math.floor(Math.random() * delay);
        await new Promise((resolve) => setTimeout(resolve, jittered));
        delay *= backoffFactor;
        return execute();
      }
      throw err;
    }
  }

  return execute();
}
