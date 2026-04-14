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

@Injectable()
export class AvitoService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AvitoService.name);

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
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('AvitoService shutting down...');
    await this.shutdown();
  }

  private async start(): Promise<void> {
    try {
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
        (err) => {
          this.setError(err.message);
        },
      );

      this.logger.log('AvitoService started — polling active');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setError(message);
    }
  }

  getStatus(): AvitoServiceStatus {
    return { ...this.status };
  }

  protected emitMessage(message: AvitoMessage): void {
    this.logger.debug(`New message from ${message.sender}: ${message.text}`);
    this.emit('message', message);
  }

  protected setError(errorMessage: string): void {
    this.status.errorMessage = errorMessage;
    this.status.isAuthenticated = false;
    this.logger.error(`AvitoService error: ${errorMessage}`);
    this.emit('error', new Error(errorMessage));
  }

  protected clearError(): void {
    this.status.errorMessage = null;
  }

  private async shutdown(): Promise<void> {
    this.status.isRunning = false;
    this.pollingService.stop();
    await this.browserService.close();
  }
}
