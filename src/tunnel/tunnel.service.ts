import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import { AppConfig } from '../config/configuration';

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const CLOUDFLARED_READY_SIGNAL = 'INF Registered tunnel connection';

@Injectable()
export class TunnelService implements OnModuleDestroy {
  private readonly logger = new Logger(TunnelService.name);
  private process: ChildProcess | null = null;
  private publicUrl: string | null = null;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async start(port: number): Promise<string | null> {
    const existingUrl = this.configService.get('tunnelUrl', { infer: true });

    if (existingUrl) {
      this.logger.log(`Using pre-configured tunnel URL: ${existingUrl}`);
      this.publicUrl = existingUrl;
      return existingUrl;
    }

    this.logger.log(`Starting cloudflared tunnel on port ${port}...`);

    return new Promise((resolve) => {
      this.process = spawn('cloudflared', [
        'tunnel',
        '--url',
        `http://localhost:${port}`,
        '--no-autoupdate',
      ]);

      const timeout = setTimeout(() => {
        this.logger.warn(
          'Cloudflared tunnel URL not detected within 30s — continuing without tunnel',
        );
        resolve(null);
      }, 30_000);

      const handleOutput = (data: Buffer): void => {
        const output = data.toString();

        const match = output.match(TUNNEL_URL_PATTERN);
        if (match) {
          this.publicUrl = match[0];
          clearTimeout(timeout);
          this.logger.log(`✓ Tunnel active: ${this.publicUrl}`);
          resolve(this.publicUrl);
        }

        if (output.includes(CLOUDFLARED_READY_SIGNAL)) {
          this.logger.debug('Cloudflared tunnel connection registered');
        }
      };

      this.process.stdout?.on('data', handleOutput);
      this.process.stderr?.on('data', handleOutput);

      this.process.on('error', (err) => {
        clearTimeout(timeout);
        if (err.message.includes('ENOENT')) {
          this.logger.warn(
            'cloudflared binary not found — tunnel disabled. ' +
              'Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation',
          );
        } else {
          this.logger.error(`Cloudflared error: ${err.message}`);
        }
        resolve(null);
      });

      this.process.on('exit', (code) => {
        if (!this.isShuttingDown) {
          this.logger.warn(`Cloudflared exited with code ${code}`);
        }
        this.process = null;
        this.publicUrl = null;
      });
    });
  }

  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.process && !this.process.killed) {
      this.logger.log('Stopping cloudflared tunnel...');
      this.process.kill('SIGTERM');
      this.process = null;
      this.logger.log('Tunnel stopped');
    }
  }
}
