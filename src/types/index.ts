export interface User {
  _id?: string;
  id?: string;
  username: string;
  online: boolean;
  in_chat: boolean;
}

export interface Message {
  _id?: string;
  msg: string;
  username: string;
  date?: number;
  chat?: string;
  username_receive?: string;
}

export interface Conversation {
  id: string;
  name: string;
  type: 'global' | 'private';
  unreadCount: number;
  lastMessage?: string;
}
