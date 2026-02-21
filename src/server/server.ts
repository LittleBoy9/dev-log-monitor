import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { Socket } from 'net';
import { JsonlStorage } from '../storage/jsonl-storage';
import { LogEntry } from '../core/log-entry';
import { ApiHandler } from './api';
import { WebSocketServer } from './websocket';

// UI assets will be injected at build time
declare const process: {
  env: {
    UI_HTML?: string;
    UI_CSS?: string;
    UI_JS?: string;
  };
};

export class DevLogServer {
  private port: number;
  private server: Server | null = null;
  private apiHandler: ApiHandler;
  private wsServer: WebSocketServer;

  constructor(port: number, storage: JsonlStorage) {
    this.port = port;
    this.apiHandler = new ApiHandler(storage);
    this.wsServer = new WebSocketServer();
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('upgrade', (req: IncomingMessage, socket: Socket) => {
        if (req.url === '/ws') {
          this.wsServer.handleUpgrade(req, socket);
        } else {
          socket.destroy();
        }
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`[dev-log] Port ${this.port} is in use. UI server not started.`);
          resolve();
        } else {
          reject(error);
        }
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.wsServer.closeAll();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  broadcast(entry: LogEntry): void {
    this.wsServer.broadcast(entry);
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || '/';

    // API routes
    if (url.startsWith('/api/')) {
      this.apiHandler.handleRequest(req, res);
      return;
    }

    // Static file serving
    if (url === '/' || url === '/index.html') {
      this.serveHtml(res);
    } else if (url === '/styles.css') {
      this.serveCss(res);
    } else if (url === '/app.js') {
      this.serveJs(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  }

  private serveHtml(res: ServerResponse): void {
    const html = process.env.UI_HTML || this.getDefaultHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private serveCss(res: ServerResponse): void {
    const css = process.env.UI_CSS || '';
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
    res.end(css);
  }

  private serveJs(res: ServerResponse): void {
    const js = process.env.UI_JS || '';
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(js);
  }

  private getDefaultHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>dev-log</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app">Loading...</div>
  <script src="/app.js"></script>
</body>
</html>`;
  }
}
