import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AvitoModule } from './avito/avito.module';
import { GatewayModule } from './gateway/gateway.module';
import { TunnelModule } from './tunnel/tunnel.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
    AvitoModule,
    GatewayModule,
    TunnelModule,
  ],
})
export class AppModule {}
