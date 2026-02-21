import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { devLogger } from '../../../..';
import { UserService } from '../user/user.service';
import { db } from '../../shared/database';

@Injectable()
export class AuthService {
  private logger = devLogger.create('AuthService', 'nest');

  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    this.logger.info('Login attempt', { email });

    // Simulate password verification
    const timer = this.logger.startTimer('password-verification');
    await this.simulateDelay(50);
    timer.end({ method: 'bcrypt' });

    const user = await this.userService.findByEmail(email);

    if (!user) {
      this.logger.warn('Login failed - user not found', { email });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    this.logger.debug('Generating JWT token');
    const token = await this.generateToken(user.id);

    this.logger.info('Login successful', { userId: user.id, email });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async register(name: string, email: string, password: string): Promise<{ token: string; user: any }> {
    this.logger.info('Registration attempt', { name, email });

    // Check if email exists
    this.logger.debug('Checking if email already exists');
    const existingUser = await db.users.findByEmail(email);

    if (existingUser) {
      this.logger.warn('Registration failed - email already exists', { email });
      throw new UnauthorizedException('Email already registered');
    }

    // Hash password
    const timer = this.logger.startTimer('password-hashing');
    const hashedPassword = await this.hashPassword(password);
    timer.end({ algorithm: 'bcrypt', rounds: 10 });

    // Create user
    this.logger.debug('Creating new user account');
    const user = await this.userService.create({ name, email, password: hashedPassword });

    // Generate token
    const token = await this.generateToken(user.id);

    this.logger.info('Registration successful', { userId: user.id });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async validateToken(token: string): Promise<{ userId: number } | null> {
    this.logger.debug('Validating token');

    // Simulate JWT verification
    await this.simulateDelay(10);

    // Mock validation - in reality would verify JWT
    if (token.startsWith('jwt-')) {
      const userId = parseInt(token.split('-')[1], 10);
      this.logger.debug('Token valid', { userId });
      return { userId };
    }

    this.logger.warn('Invalid token provided');
    return null;
  }

  private async generateToken(userId: number): Promise<string> {
    await this.simulateDelay(20);
    return `jwt-${userId}-${Date.now()}`;
  }

  private async hashPassword(password: string): Promise<string> {
    await this.simulateDelay(80);
    return `hashed-${password}`;
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
