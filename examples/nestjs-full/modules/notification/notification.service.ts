import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { devLogger } from 'dev-log-monitor';
import { db } from '../../shared/database';
import { UserService } from '../user/user.service';

@Injectable()
export class NotificationService {
  private logger = devLogger.create('NotificationService', 'nest');

  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {}

  async sendEmail(userId: number, subject: string, body: string): Promise<void> {
    this.logger.info('Sending email notification', { userId, subject });

    // Get user email
    const user = await this.userService.findById(userId);

    // Simulate email sending
    const timer = this.logger.startTimer('email-send');
    await this.simulateExternalService(150);
    timer.end({ provider: 'sendgrid', to: user.email });

    // Store notification
    await db.notifications.create({
      userId,
      type: 'email',
      message: `${subject}: ${body}`,
    });

    this.logger.info('Email sent successfully', { userId, email: user.email });
  }

  async sendSMS(userId: number, message: string): Promise<void> {
    this.logger.info('Sending SMS notification', { userId });

    const timer = this.logger.startTimer('sms-send');
    await this.simulateExternalService(200);
    timer.end({ provider: 'twilio' });

    await db.notifications.create({
      userId,
      type: 'sms',
      message,
    });

    this.logger.info('SMS sent successfully', { userId });
  }

  async sendPushNotification(userId: number, title: string, body: string): Promise<void> {
    this.logger.info('Sending push notification', { userId, title });

    const timer = this.logger.startTimer('push-send');
    await this.simulateExternalService(100);
    timer.end({ provider: 'firebase' });

    await db.notifications.create({
      userId,
      type: 'push',
      message: `${title}: ${body}`,
    });

    this.logger.debug('Push notification sent', { userId });
  }

  async sendOrderConfirmation(userId: number, orderId: number, total: number): Promise<void> {
    this.logger.info('Sending order confirmation', { userId, orderId, total });

    // Send multiple notifications
    this.logger.debug('Sending email confirmation');
    await this.sendEmail(
      userId,
      'Order Confirmed',
      `Your order #${orderId} for $${total.toFixed(2)} has been confirmed.`
    );

    this.logger.debug('Sending push notification');
    await this.sendPushNotification(
      userId,
      'Order Confirmed! 🎉',
      `Order #${orderId} - $${total.toFixed(2)}`
    );

    this.logger.info('Order confirmation sent', { orderId });
  }

  async sendOrderCancellation(userId: number, orderId: number): Promise<void> {
    this.logger.info('Sending order cancellation notification', { userId, orderId });

    await this.sendEmail(
      userId,
      'Order Cancelled',
      `Your order #${orderId} has been cancelled. Any payment will be refunded within 5-7 business days.`
    );

    this.logger.info('Cancellation notification sent', { orderId });
  }

  async sendWelcomeEmail(userId: number, name: string): Promise<void> {
    this.logger.info('Sending welcome email', { userId, name });

    await this.sendEmail(
      userId,
      'Welcome to Our Platform!',
      `Hi ${name}, welcome aboard! We're excited to have you.`
    );

    await this.sendPushNotification(
      userId,
      'Welcome! 👋',
      'Thanks for joining us. Check out our latest products!'
    );

    this.logger.info('Welcome notifications sent', { userId });
  }

  async getNotificationHistory(userId: number) {
    this.logger.info('Fetching notification history', { userId });

    const timer = this.logger.startTimer('db-query-notifications');
    const notifications = await db.notifications.findByUserId(userId);
    timer.end({ count: notifications.length });

    return notifications;
  }

  private simulateExternalService(baseMs: number): Promise<void> {
    const delay = baseMs + Math.random() * 100;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
