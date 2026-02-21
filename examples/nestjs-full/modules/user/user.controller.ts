import { Controller, Get, Param, ParseIntPipe, Inject, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { OrderService } from '../order/order.service';
import { devLogger } from '../../../..';

@Controller('users')
export class UserController {
  private logger = devLogger.create('UserController', 'nest');

  constructor(
    private userService: UserService,
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) {}

  @Get()
  async findAll() {
    this.logger.info('GET /users');
    return this.userService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('GET /users/:id', { id });
    return this.userService.findById(id);
  }

  @Get(':id/orders')
  async getUserOrders(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('GET /users/:id/orders', { id });

    // First validate user exists
    this.logger.debug('Validating user exists');
    await this.userService.findById(id);

    // Then get their orders
    this.logger.debug('Fetching user orders');
    return this.orderService.findByUserId(id);
  }
}
