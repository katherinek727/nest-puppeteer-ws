import { Module } from '@nestjs/common';
import { AvitoService } from './avito.service';

@Module({
  providers: [AvitoService],
  exports: [AvitoService],
})
export class AvitoModule {}
