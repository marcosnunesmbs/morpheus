import type { MorpheusToSmithMessage, SmithToMorpheusMessage } from './ISmithProtocol.js';

/**
 * Transport layer interface — abstracts WebSocket communication.
 * Used on both sides (Morpheus client → Smith, Smith server → Morpheus).
 */
export interface ISmithTransport {
  /** Establish connection */
  connect(): Promise<void>;

  /** Send a message to the remote end */
  send(message: MorpheusToSmithMessage | SmithToMorpheusMessage): void;

  /** Register a message handler */
  onMessage(handler: (message: MorpheusToSmithMessage | SmithToMorpheusMessage) => void): void;

  /** Register disconnect handler */
  onDisconnect(handler: (reason: string) => void): void;

  /** Register error handler */
  onError(handler: (error: Error) => void): void;

  /** Close connection gracefully */
  disconnect(): Promise<void>;

  /** Check if transport is connected */
  readonly connected: boolean;
}
