import { Module } from '@nestjs/common';
import { AvitoModule } from '../avito/avito.module';
import { MessagesGateway } from './messages.gateway';

@Module({
  imports: [AvitoModule],
  providers: [MessagesGateway],
})
export class GatewayModule {}
