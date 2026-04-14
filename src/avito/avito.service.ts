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

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('AvitoService initializing...');
    // Browser launch and polling will be wired in subsequent steps
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('AvitoService shutting down...');
    await this.shutdown();
  }

  getStatus(): AvitoServiceStatus {
    return { ...this.status };
  }

  // Called by polling loop — emits to WebSocket gateway
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
    // Browser teardown will be added in Step 9
  }
}
