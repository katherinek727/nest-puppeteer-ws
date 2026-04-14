import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelayMs: 3_000,
  maxDelayMs: 60_000,
  backoffFactor: 2,
};

export class RetryStrategy {
  private readonly logger = new Logger(RetryStrategy.name);
  private attempt = 0;
  private currentDelayMs: number;

  constructor(private readonly options: RetryOptions = DEFAULT_RETRY_OPTIONS) {
    this.currentDelayMs = options.initialDelayMs;
  }

  get hasAttemptsLeft(): boolean {
    return this.attempt < this.options.maxAttempts;
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  reset(): void {
    this.attempt = 0;
    this.currentDelayMs = this.options.initialDelayMs;
    this.logger.debug('Retry strategy reset');
  }

  async waitBeforeRetry(): Promise<void> {
    this.attempt++;
    const delay = this.currentDelayMs;

    this.logger.warn(
      `Retry attempt ${this.attempt}/${this.options.maxAttempts} — waiting ${delay}ms before reconnect...`,
    );

    await this.sleep(delay);

    // Exponential backoff capped at maxDelayMs
    this.currentDelayMs = Math.min(
      this.currentDelayMs * this.options.backoffFactor,
      this.options.maxDelayMs,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
