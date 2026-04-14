import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { validateConfig } from './config/config.validator';
import { TunnelService } from './tunnel/tunnel.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  validateConfig();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST'],
  });

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
}

bootstrap();
