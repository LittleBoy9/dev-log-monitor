import { Controller, Post, Body, Get, Param, ParseIntPipe } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { devLogger } from '../../../..';

@Controller('notifications')
export class NotificationController {
  private logger = devLogger.create('NotificationController', 'nest');

  constructor(private notificationService: NotificationService) {}

  @Post('test')
  async testNotification(@Body() body: { userId: number; type: 'email' | 'sms' | 'push' }) {
    this.logger.info('POST /notifications/test', { userId: body.userId, type: body.type });

    switch (body.type) {
      case 'email':
        await this.notificationService.sendEmail(body.userId, 'Test Email', 'This is a test email notification.');
        break;
      case 'sms':
        await this.notificationService.sendSMS(body.userId, 'This is a test SMS notification.');
        break;
      case 'push':
        await this.notificationService.sendPushNotification(body.userId, 'Test Push', 'This is a test push notification.');
        break;
    }

    return { message: `Test ${body.type} notification sent` };
  }

  @Get('user/:userId')
  async getUserNotifications(@Param('userId', ParseIntPipe) userId: number) {
    this.logger.info('GET /notifications/user/:userId', { userId });
    return this.notificationService.getNotificationHistory(userId);
  }
}
