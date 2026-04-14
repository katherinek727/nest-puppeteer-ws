export interface AvitoMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  chatUrl: string;
}

export interface AvitoServiceStatus {
  isRunning: boolean;
  isAuthenticated: boolean;
  lastPollAt: Date | null;
  errorMessage: string | null;
}
