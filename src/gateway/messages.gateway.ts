import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AvitoService } from '../avito/avito.service';
import { AvitoMessage } from '../avito/avito.types';
import { WS_EVENTS } from './events';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})
export class MessagesGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(private readonly avitoService: AvitoService) {}

  onModuleInit(): void {
    this.avitoService.on('message', (msg: AvitoMessage) => {
      this.broadcastMessage(msg);
    });

    this.avitoService.on('error', (err: Error) => {
      this.server?.emit(WS_EVENTS.SERVICE_ERROR, {
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    });

    this.avitoService.on('fatal', (err: Error) => {
      this.server?.emit(WS_EVENTS.SERVICE_FATAL, {
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  afterInit(_server: Server): void {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);

    // Send current service status immediately on connect
    const status = this.avitoService.getStatus();
    client.emit(WS_EVENTS.SERVICE_STATUS, {
      ...status,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WS_EVENTS.GET_STATUS)
  handleGetStatus(client: Socket): void {
    const status = this.avitoService.getStatus();
    client.emit(WS_EVENTS.SERVICE_STATUS, {
      ...status,
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastMessage(message: AvitoMessage): void {
    const connectedClients = this.server?.sockets?.sockets?.size ?? 0;
    this.logger.log(
      `Broadcasting message to ${connectedClients} client(s): "${message.text.slice(0, 50)}"`,
    );

    this.server?.emit(WS_EVENTS.NEW_MESSAGE, {
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestamp: message.timestamp.toISOString(),
      chatUrl: message.chatUrl,
    });
  }
}
