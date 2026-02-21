import { Injectable, NotFoundException } from '@nestjs/common';
import { devLogger } from '../../../..';
import { db, User } from '../../shared/database';

@Injectable()
export class UserService {
  private logger = devLogger.create('UserService', 'nest');

  async findAll(): Promise<User[]> {
    this.logger.info('Fetching all users');

    const timer = this.logger.startTimer('db-query-users');
    const users = await db.users.findAll();
    timer.end({ count: users.length });

    this.logger.debug('Users fetched', { count: users.length });
    return users;
  }

  async findById(id: number): Promise<User> {
    this.logger.info('Finding user by ID', { id });

    const timer = this.logger.startTimer('db-query-user-by-id');
    const user = await db.users.findById(id);
    timer.end({ found: !!user });

    if (!user) {
      this.logger.warn('User not found', { id });
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.debug('User found', { id, name: user.name });
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    this.logger.debug('Finding user by email', { email });

    const timer = this.logger.startTimer('db-query-user-by-email');
    const user = await db.users.findByEmail(email);
    timer.end({ found: !!user });

    return user;
  }

  async create(data: { name: string; email: string; password: string }): Promise<User> {
    this.logger.info('Creating new user', { name: data.name, email: data.email });

    const timer = this.logger.startTimer('db-insert-user');
    const user = await db.users.create(data);
    timer.end({ userId: user.id });

    this.logger.info('User created successfully', { userId: user.id });
    return user;
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    this.logger.info('Updating user', { id, fields: Object.keys(data) });

    // First check if user exists
    await this.findById(id);

    const timer = this.logger.startTimer('db-update-user');
    const user = await db.users.update(id, data);
    timer.end();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.info('User updated successfully', { id });
    return user;
  }

  async validateUserExists(id: number): Promise<boolean> {
    this.logger.debug('Validating user exists', { id });
    const user = await db.users.findById(id);
    return !!user;
  }
}
