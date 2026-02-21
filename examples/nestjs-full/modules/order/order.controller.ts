import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { OrderService } from './order.service';
import { devLogger } from '../../../..';

@Controller('orders')
export class OrderController {
  private logger = devLogger.create('OrderController', 'nest');

  constructor(private orderService: OrderService) {}

  @Get()
  async findAll() {
    this.logger.info('GET /orders');
    return this.orderService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('GET /orders/:id', { id });
    return this.orderService.findById(id);
  }

  @Post()
  async create(
    @Body() body: { userId: number; items: { productId: number; quantity: number }[] }
  ) {
    this.logger.info('POST /orders', { userId: body.userId, itemCount: body.items?.length });
    return this.orderService.createOrder(body.userId, body.items);
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('POST /orders/:id/cancel', { id });
    return this.orderService.cancelOrder(id);
  }

  @Post(':id/pay')
  async pay(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('POST /orders/:id/pay', { id });
    await this.orderService.processPayment(id);
    return { message: 'Payment processed successfully' };
  }
}
