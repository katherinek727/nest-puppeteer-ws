import { Module } from '@nestjs/common';
import { AvitoService } from './avito.service';
import { BrowserService } from './browser.service';
import { PollingService } from './polling.service';

@Module({
  providers: [AvitoService, BrowserService, PollingService],
  exports: [AvitoService],
})
export class AvitoModule {}
