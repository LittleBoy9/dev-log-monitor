import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => OrderModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
