import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TestController } from './test.controller';

@Module({
  imports: [
    AuthModule,
    UserModule,
    ProductModule,
    OrderModule,
    NotificationModule,
  ],
  controllers: [TestController],
})
export class AppModule {}
