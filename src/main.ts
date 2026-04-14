import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { validateConfig } from './config/config.validator';
import { TunnelService } from './tunnel/tunnel.service';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  validateConfig();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST'],
  });

  // Enable NestJS built-in shutdown hooks (triggers OnModuleDestroy)
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);

  // Start tunnel after server is ready
  const tunnelService = app.get(TunnelService);
  const publicUrl = await tunnelService.start(port);

  if (publicUrl) {
    logger.log(`Public URL (Cloudflared): ${publicUrl}`);
  } else {
    logger.warn('Running without public tunnel — local access only');
  }

  // ── Graceful shutdown ──────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal} — initiating graceful shutdown...`);
    try {
      await app.close();
      logger.log('Application closed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  // ── Safety nets ────────────────────────────────────────────
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Promise Rejection', String(reason));
    // Do not exit — let NestJS error handling take over
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught Exception: ${err.message}`, err.stack);
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('Fatal error during bootstrap', String(err));
  process.exit(1);
});
