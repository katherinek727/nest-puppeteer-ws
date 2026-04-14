import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { AppConfig } from '../config/configuration';
import { AvitoMessage, AvitoServiceStatus } from './avito.types';
import { BrowserService } from './browser.service';
import { PollingService } from './polling.service';
import { RetryStrategy, DEFAULT_RETRY_OPTIONS } from './retry.strategy';

const SESSION_EXPIRY_SIGNALS = [
  'session expiry',
  'chat list not found',
  'authentication failed',
  'navigation timeout',
];

@Injectable()
export class AvitoService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AvitoService.name);
  private readonly retryStrategy = new RetryStrategy(DEFAULT_RETRY_OPTIONS);
  private isDestroyed = false;

  private readonly status: AvitoServiceStatus = {
    isRunning: false,
    isAuthenticated: false,
    lastPollAt: null,
    errorMessage: null,
  };

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly browserService: BrowserService,
    private readonly pollingService: PollingService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('AvitoService initializing...');
    await this.startWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('AvitoService shutting down...');
    this.isDestroyed = true;
    await this.shutdown();
  }

  getStatus(): AvitoServiceStatus {
    return { ...this.status };
  }

  private async startWithRetry(): Promise<void> {
    while (!this.isDestroyed) {
      const success = await this.start();

      if (success) {
        this.retryStrategy.reset();
        return;
      }

      if (!this.retryStrategy.hasAttemptsLeft) {
        this.logger.error(
          `Max reconnect attempts (${DEFAULT_RETRY_OPTIONS.maxAttempts}) reached. Giving up.`,
        );
        this.emit('fatal', new Error('Max reconnect attempts exceeded'));
        return;
      }

      await this.retryStrategy.waitBeforeRetry();
    }
  }

  private async start(): Promise<boolean> {
    try {
      // Clean up any previous browser instance before restarting
      await this.browserService.close();
      this.pollingService.stop();

      await this.browserService.launch();
      await this.browserService.login();
      await this.browserService.navigateToMessenger();

      this.status.isAuthenticated = true;
      this.status.isRunning = true;
      this.clearError();

      const page = this.browserService.getPage()!;
      const targetSender = this.configService.get('avito.targetSender', {
        infer: true,
      });

      this.pollingService.start(
        page,
        targetSender,
        (msg) => {
          this.status.lastPollAt = new Date();
          this.emitMessage(msg);
        },
        (err) => this.handlePollingError(err),
      );

      this.logger.log('AvitoService started — polling active');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setError(message);
      return false;
    }
  }

  private handlePollingError(err: Error): void {
    const isSessionExpiry = SESSION_EXPIRY_SIGNALS.some((signal) =>
      err.message.toLowerCase().includes(signal.toLowerCase()),
    );

    if (isSessionExpiry && !this.isDestroyed) {
      this.logger.warn('Session expiry detected — scheduling reconnect...');
      this.pollingService.stop();
      this.status.isAuthenticated = false;
      this.status.isRunning = false;

      // Reconnect asynchronously — don't block the polling callback
      void this.startWithRetry();
    } else {
      this.setError(err.message);
    }
  }

  private emitMessage(message: AvitoMessage): void {
    this.logger.debug(`New message from ${message.sender}: ${message.text}`);
    this.emit('message', message);
  }

  private setError(errorMessage: string): void {
    this.status.errorMessage = errorMessage;
    this.status.isAuthenticated = false;
    this.logger.error(`AvitoService error: ${errorMessage}`);
    this.emit('error', new Error(errorMessage));
  }

  private clearError(): void {
    this.status.errorMessage = null;
  }

  private async shutdown(): Promise<void> {
    this.status.isRunning = false;
    this.status.isAuthenticated = false;
    this.pollingService.stop();
    await this.browserService.close();
  }
}
