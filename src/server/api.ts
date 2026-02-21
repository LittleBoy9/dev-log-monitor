import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { LogFilter } from '../core/log-entry';
import { JsonlStorage } from '../storage/jsonl-storage';

export class ApiHandler {
  private storage: JsonlStorage;

  constructor(storage: JsonlStorage) {
    this.storage = storage;
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost`);
    const path = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (path === '/api/logs' && req.method === 'GET') {
        await this.getLogs(url, res);
      } else if (path === '/api/logs' && req.method === 'DELETE') {
        await this.clearLogs(res);
      } else if (path === '/api/contexts' && req.method === 'GET') {
        await this.getContexts(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async getLogs(url: URL, res: ServerResponse): Promise<void> {
    const filter: LogFilter = {};

    const level = url.searchParams.get('level');
    if (level) {
      filter.level = level.split(',') as LogFilter['level'];
    }

    const context = url.searchParams.get('context');
    if (context) {
      filter.context = context;
    }

    const search = url.searchParams.get('search');
    if (search) {
      filter.search = search;
    }

    const since = url.searchParams.get('since');
    if (since) {
      filter.since = since;
    }

    const until = url.searchParams.get('until');
    if (until) {
      filter.until = until;
    }

    const limit = url.searchParams.get('limit');
    if (limit) {
      filter.limit = parseInt(limit, 10);
    }

    const offset = url.searchParams.get('offset');
    if (offset) {
      filter.offset = parseInt(offset, 10);
    }

    const logs = await this.storage.query(filter);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ logs, total: logs.length }));
  }

  private async clearLogs(res: ServerResponse): Promise<void> {
    await this.storage.clear();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  private async getContexts(res: ServerResponse): Promise<void> {
    const contexts = this.storage.getContexts();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ contexts }));
  }
}
