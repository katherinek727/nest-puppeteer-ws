// WebSocket event names — single source of truth for client and server
export const WS_EVENTS = {
  // Server → Client
  NEW_MESSAGE: 'message:new',
  SERVICE_STATUS: 'service:status',
  SERVICE_ERROR: 'service:error',
  SERVICE_FATAL: 'service:fatal',

  // Client → Server
  GET_STATUS: 'service:getStatus',
} as const;
