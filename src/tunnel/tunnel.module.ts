import { Module } from '@nestjs/common';
import { TunnelService } from './tunnel.service';

@Module({
  providers: [TunnelService],
  exports: [TunnelService],
})
export class TunnelModule {}
