import { ISmithProtocol } from '../../specs/001-smith-agent/contracts/ISmithProtocol.js';

export interface SmithMessage {
  type: string;
  payload: any;
}

export interface SmithResponse {
  status: string;
  data?: any;
  error?: string;
}

export interface SmithProtocol {
  sendMessage(message: SmithMessage): Promise<SmithResponse>;
  receiveMessage(): Promise<SmithMessage>;
  onMessage(callback: (message: SmithMessage) => void): void;
}