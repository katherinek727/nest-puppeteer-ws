import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { AppConfig } from '../config/configuration';

const AVITO_LOGIN_URL = 'https://www.avito.ru/profile/login';
const AVITO_MESSAGES_URL = 'https://www.avito.ru/messenger';

const SELECTORS = {
  phoneInput: 'input[name="login"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]',
  loginForm: 'form[action*="login"]',
  userAvatar: '[data-marker="header/userAvatar"]',
  messengerContainer: '[data-marker="messenger/container"]',
} as const;

@Injectable()
export class BrowserService {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async launch(): Promise<Page> {
    this.logger.log('Launching Puppeteer browser...');

    const headless = this.configService.get('puppeteer.headless', {
      infer: true,
    });
    const slowMo = this.configService.get('puppeteer.slowMo', { infer: true });

    this.browser = await puppeteer.launch({
      headless,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    this.page = await this.browser.newPage();

    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/122.0.0.0 Safari/537.36',
    );

    this.logger.log('Browser launched successfully');
    return this.page;
  }

  async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const login = this.configService.get('avito.login', { infer: true });
    const password = this.configService.get('avito.password', { infer: true });

    this.logger.log('Navigating to Avito login page...');
    await this.page.goto(AVITO_LOGIN_URL, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });

    this.logger.log('Filling login credentials...');
    await this.page.waitForSelector(SELECTORS.phoneInput, { timeout: 15_000 });
    await this.page.type(SELECTORS.phoneInput, login, { delay: 80 });

    await this.page.waitForSelector(SELECTORS.submitButton, {
      timeout: 10_000,
    });
    await this.page.click(SELECTORS.submitButton);

    await this.page.waitForSelector(SELECTORS.passwordInput, {
      timeout: 15_000,
    });
    await this.page.type(SELECTORS.passwordInput, password, { delay: 80 });
    await this.page.click(SELECTORS.submitButton);

    this.logger.log('Waiting for authentication confirmation...');
    await this.page
      .waitForSelector(SELECTORS.userAvatar, { timeout: 20_000 })
      .catch(() => {
        throw new Error(
          'Authentication failed: user avatar not found after login attempt.',
        );
      });

    this.logger.log('Successfully authenticated with Avito');
  }

  async navigateToMessenger(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched.');
    }

    this.logger.log('Navigating to Avito Messenger...');
    await this.page.goto(AVITO_MESSAGES_URL, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });

    await this.page
      .waitForSelector(SELECTORS.messengerContainer, { timeout: 20_000 })
      .catch(() => {
        throw new Error('Messenger page did not load correctly.');
      });

    this.logger.log('Messenger page loaded');
  }

  getPage(): Page | null {
    return this.page;
  }

  isRunning(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  async close(): Promise<void> {
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.logger.log('Browser closed');
    }
  }
}
