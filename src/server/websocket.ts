import { createHash } from 'crypto';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { LogEntry } from '../core/log-entry';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export class WebSocketServer {
  private clients: Set<Socket> = new Set();

  handleUpgrade(req: IncomingMessage, socket: Socket): void {
    const key = req.headers['sec-websocket-key'];

    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = createHash('sha1').update(key + GUID).digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n');

    socket.write(headers);
    this.clients.add(socket);

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.clients.delete(socket);
    });

    // Handle incoming frames (ping/pong)
    socket.on('data', (buffer) => {
      this.handleFrame(socket, buffer);
    });
  }

  private handleFrame(socket: Socket, buffer: Buffer): void {
    const opcode = buffer[0] & 0x0f;

    // Ping frame - respond with pong
    if (opcode === 0x09) {
      const pongFrame = Buffer.from([0x8a, 0x00]);
      socket.write(pongFrame);
    }

    // Close frame
    if (opcode === 0x08) {
      socket.end();
      this.clients.delete(socket);
    }
  }

  broadcast(entry: LogEntry): void {
    const message = JSON.stringify({ type: 'log', data: entry });
    const frame = this.createFrame(message);

    for (const client of this.clients) {
      try {
        client.write(frame);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  private createFrame(message: string): Buffer {
    const payload = Buffer.from(message);
    const length = payload.length;

    let frame: Buffer;

    if (length < 126) {
      frame = Buffer.alloc(2 + length);
      frame[0] = 0x81; // Text frame, FIN
      frame[1] = length;
      payload.copy(frame, 2);
    } else if (length < 65536) {
      frame = Buffer.alloc(4 + length);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(length, 2);
      payload.copy(frame, 4);
    } else {
      frame = Buffer.alloc(10 + length);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(length), 2);
      payload.copy(frame, 10);
    }

    return frame;
  }

  closeAll(): void {
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // Ignore
      }
    }
    this.clients.clear();
  }
}
