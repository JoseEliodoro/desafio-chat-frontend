import axios from 'axios';
import { User, Message } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
});

export const createUser = async (username: string): Promise<User> => {
  const response = await httpClient.post<User>('/create-user', { username });
  return response.data;
};

export const getUsers = async (): Promise<User[]> => {
  const response = await httpClient.get<User[]>('/find-users');
  return response.data;
};

export const getMessagesHistory = async (): Promise<Message[]> => {
  const response = await httpClient.get<Message[]>('/find-messages');
  return response.data;
};

export class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallback: (msg: any) => void;
  private onStatusChangeCallback: (status: 'connecting' | 'connected' | 'disconnected', error?: string) => void;
  private reconnectInterval = 3000;
  private reconnectTimer: number | null = null;
  private isIntentionalDisconnect = false;
  constructor(
    username: string,
    onMessage: (msg: any) => void,
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected', error?: string) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;
    
    const urlObj = new URL(apiBaseUrl);
    urlObj.protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
    urlObj.pathname = '/ws';
    urlObj.searchParams.set('username', username);
    this.url = urlObj.toString();
  }

  connect() {
    this.isIntentionalDisconnect = false;
    this.onStatusChangeCallback('connecting');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.onStatusChangeCallback('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessageCallback(data);
        } catch (e) {
          console.error('Erro ao processar mensagem JSON do WebSocket:', e);
        }
      };

      this.ws.onerror = (event) => {
        console.error('Erro no WebSocket:', event);
      };

      this.ws.onclose = (event) => {
        this.onStatusChangeCallback('disconnected', event.reason || 'Conexão encerrada pelo servidor');
        if (!this.isIntentionalDisconnect) {
          this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectInterval);
        }
      };
    } catch (err: any) {
      this.onStatusChangeCallback('disconnected', err.message);
      if (!this.isIntentionalDisconnect) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectInterval);
      }
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendCommand(command: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      console.warn('Não é possível enviar o comando, o WebSocket não está aberto:', command);
    }
  }

  connectRoom(roomName: string, password?: string) {
    this.sendCommand({
      command: 'connect_room',
      room: roomName,
      password: password || null,
    });
  }

  createRoom(roomName: string, password?: string, limit = 3) {
    this.sendCommand({
      command: 'create_room',
      room: roomName,
      password: password || null,
      limit,
    });
  }

  disconnectRoom() {
    this.sendCommand({
      command: 'disconnect_room',
    });
  }

  sendMessage(msg: string, receiverUsername?: string) {
    const payload: any = {
      command: 'send_message',
      msg,
    };
    if (receiverUsername) {
      payload.username_receive = receiverUsername;
    }
    this.sendCommand(payload);
  }
}
