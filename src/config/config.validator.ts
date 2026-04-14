import { Logger } from '@nestjs/common';

const logger = new Logger('ConfigValidator');

export function validateConfig(): void {
  const required: Record<string, string | undefined> = {
    AVITO_LOGIN: process.env.AVITO_LOGIN,
    AVITO_PASSWORD: process.env.AVITO_PASSWORD,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value || value.trim() === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please copy .env.example to .env and fill in the values.');
    process.exit(1);
  }

  logger.log('Environment configuration validated successfully');
}
