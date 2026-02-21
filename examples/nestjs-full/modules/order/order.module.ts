import { Module, forwardRef } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    ProductModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
