export interface AppConfig {
  port: number;
  avito: {
    login: string;
    password: string;
    targetSender: string;
  };
  puppeteer: {
    headless: boolean;
    slowMo: number;
  };
  pollingIntervalMs: number;
  tunnelUrl: string;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  avito: {
    login: process.env.AVITO_LOGIN ?? '',
    password: process.env.AVITO_PASSWORD ?? '',
    targetSender: process.env.AVITO_TARGET_SENDER ?? 'Рушан',
  },
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    slowMo: parseInt(process.env.PUPPETEER_SLOW_MO ?? '0', 10),
  },
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS ?? '5000', 10),
  tunnelUrl: process.env.TUNNEL_URL ?? '',
});
