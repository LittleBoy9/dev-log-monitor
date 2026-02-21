/**
 * NestJS Test Example
 *
 * Run with: npx ts-node -r tsconfig-paths/register --project examples/tsconfig.json examples/nestjs-test.ts
 * (requires: npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata tsconfig-paths)
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Post, Body, Injectable, Logger } from '@nestjs/common';
import { devLogger } from 'dev-log-monitor';

// User Service with scoped logger
@Injectable()
class UserService {
  private logger = devLogger.create('UserService');

  getUsers() {
    this.logger.info('Fetching all users');
    this.logger.debug('Database query executed', { table: 'users' });
    return [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
  }

  createUser(data: { name: string; email: string }) {
    this.logger.info('Creating new user', { name: data.name });
    this.logger.debug('User data validated', { email: data.email });
    return { id: 3, ...data };
  }

  triggerError() {
    this.logger.error('Database connection failed', {
      host: 'localhost',
      port: 5432,
    });
    throw new Error('Database error');
  }
}

// App Controller
@Controller()
class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private userService: UserService) {}

  @Get()
  getHello() {
    this.logger.log('Home endpoint accessed');
    return { message: 'Hello from NestJS!' };
  }

  @Get('users')
  getUsers() {
    this.logger.log('Users endpoint accessed');
    return this.userService.getUsers();
  }

  @Post('users')
  createUser(@Body() body: { name: string; email: string }) {
    this.logger.log('Create user endpoint accessed');
    return this.userService.createUser(body);
  }

  @Get('warn')
  triggerWarn() {
    this.logger.warn('This is a warning message');
    return { status: 'warned' };
  }

  @Get('error')
  triggerError() {
    try {
      this.userService.triggerError();
    } catch (e) {
      this.logger.error('Caught error', (e as Error).stack);
      return { error: 'Something went wrong' };
    }
  }

  @Get('debug')
  triggerDebug() {
    this.logger.debug('Debug information');
    this.logger.verbose('Verbose logging test (maps to debug)');
    return { status: 'debug logged' };
  }
}

// App Module
@Module({
  controllers: [AppController],
  providers: [UserService],
})
class AppModule {}

// Bootstrap
async function bootstrap() {
  // Initialize dev-log first
  await devLogger.init({ port: 3333 });

  // Create NestJS app with dev-log as the logger
  const app = await NestFactory.create(AppModule, {
    logger: devLogger.nest(),
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await app.close();
    await devLogger.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const PORT = 4001;
  await app.listen(PORT);

  devLogger.info('NestJS server started', { port: PORT });
  console.log(`\nNestJS server running at http://localhost:${PORT}`);
  console.log(`View logs at http://localhost:3333\n`);
  console.log('Test endpoints:');
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  GET  http://localhost:${PORT}/users`);
  console.log(`  POST http://localhost:${PORT}/users`);
  console.log(`  GET  http://localhost:${PORT}/warn`);
  console.log(`  GET  http://localhost:${PORT}/error`);
  console.log(`  GET  http://localhost:${PORT}/debug\n`);
}

bootstrap().catch(console.error);
