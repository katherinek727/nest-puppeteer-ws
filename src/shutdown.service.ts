import {
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownService.name);
  private readonly startTime = Date.now();

  onApplicationShutdown(signal?: string): void {
    const uptime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    this.logger.log(
      `Shutdown triggered by signal: ${signal ?? 'unknown'} | Uptime: ${uptime}s`,
    );
  }
}
