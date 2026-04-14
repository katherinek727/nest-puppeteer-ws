import { Module } from '@nestjs/common';
import { AvitoService } from './avito.service';
import { BrowserService } from './browser.service';

@Module({
  providers: [AvitoService, BrowserService],
  exports: [AvitoService],
})
export class AvitoModule {}
