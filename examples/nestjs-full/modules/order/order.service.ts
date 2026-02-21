import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { devLogger } from '../../../..';
import { db, Order, OrderItem } from '../../shared/database';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OrderService {
  private logger = devLogger.create('OrderService', 'nest');

  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private productService: ProductService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
  ) {}

  async findAll(): Promise<Order[]> {
    this.logger.info('Fetching all orders');

    const timer = this.logger.startTimer('db-query-orders');
    const orders = await db.orders.findAll();
    timer.end({ count: orders.length });

    return orders;
  }

  async findById(id: number): Promise<Order> {
    this.logger.info('Finding order by ID', { id });

    const timer = this.logger.startTimer('db-query-order');
    const order = await db.orders.findById(id);
    timer.end({ found: !!order });

    if (!order) {
      this.logger.warn('Order not found', { id });
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByUserId(userId: number): Promise<Order[]> {
    this.logger.info('Finding orders by user ID', { userId });

    const timer = this.logger.startTimer('db-query-user-orders');
    const orders = await db.orders.findByUserId(userId);
    timer.end({ count: orders.length });

    return orders;
  }

  async createOrder(
    userId: number,
    items: { productId: number; quantity: number }[]
  ): Promise<Order> {
    this.logger.info('Creating new order', { userId, itemCount: items.length });

    // Step 1: Validate user exists
    this.logger.debug('Step 1: Validating user');
    const userExists = await this.userService.validateUserExists(userId);
    if (!userExists) {
      this.logger.error('Order creation failed - user not found', { userId });
      throw new BadRequestException(`User with ID ${userId} not found`);
    }

    // Step 2: Validate and reserve stock for all items
    this.logger.debug('Step 2: Checking and reserving stock');
    const reservedItems: { productId: number; quantity: number }[] = [];

    try {
      for (const item of items) {
        this.logger.debug('Checking stock for product', { productId: item.productId, quantity: item.quantity });
        await this.productService.checkAndReserveStock(item.productId, item.quantity);
        reservedItems.push(item);
      }
    } catch (error) {
      // Rollback: Release already reserved stock
      this.logger.warn('Stock check failed, rolling back reservations', {
        reservedCount: reservedItems.length,
      });

      for (const reserved of reservedItems) {
        await this.productService.releaseStock(reserved.productId, reserved.quantity);
      }

      throw error;
    }

    // Step 3: Calculate total price
    this.logger.debug('Step 3: Calculating total price');
    const total = await this.productService.calculateTotalPrice(items);

    // Step 4: Get product details for order items
    this.logger.debug('Step 4: Fetching product details');
    const products = await this.productService.findByIds(items.map((i) => i.productId));

    const orderItems: OrderItem[] = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      };
    });

    // Step 5: Create order in database
    this.logger.debug('Step 5: Saving order to database');
    const timer = this.logger.startTimer('db-insert-order');
    const order = await db.orders.create({
      userId,
      items: orderItems,
      status: 'pending',
      total,
    });
    timer.end({ orderId: order.id });

    // Step 6: Send confirmation notification
    this.logger.debug('Step 6: Sending order confirmation');
    try {
      await this.notificationService.sendOrderConfirmation(userId, order.id, total);
    } catch (notifError) {
      this.logger.warn('Failed to send order confirmation notification', {
        orderId: order.id,
        error: (notifError as Error).message,
      });
      // Don't fail the order if notification fails
    }

    this.logger.info('Order created successfully', {
      orderId: order.id,
      userId,
      total,
      itemCount: items.length,
    });

    return order;
  }

  async cancelOrder(id: number): Promise<Order> {
    this.logger.info('Cancelling order', { id });

    // Get order
    const order = await this.findById(id);

    // Check if cancellable
    if (order.status === 'delivered' || order.status === 'cancelled') {
      this.logger.warn('Cannot cancel order - invalid status', { id, status: order.status });
      throw new BadRequestException(`Cannot cancel order with status: ${order.status}`);
    }

    // Release stock
    this.logger.debug('Releasing stock for cancelled order');
    for (const item of order.items) {
      await this.productService.releaseStock(item.productId, item.quantity);
    }

    // Update status
    this.logger.debug('Updating order status to cancelled');
    const timer = this.logger.startTimer('db-update-order-status');
    await db.orders.updateStatus(id, 'cancelled');
    timer.end();

    // Send cancellation notification
    this.logger.debug('Sending cancellation notification');
    try {
      await this.notificationService.sendOrderCancellation(order.userId, id);
    } catch (notifError) {
      this.logger.warn('Failed to send cancellation notification', { orderId: id });
    }

    const updatedOrder = await this.findById(id);
    this.logger.info('Order cancelled successfully', { id });

    return updatedOrder;
  }

  async processPayment(orderId: number): Promise<void> {
    this.logger.info('Processing payment', { orderId });

    const timer = this.logger.startTimer('payment-processing');

    // Simulate payment gateway call
    await this.simulateDelay(200 + Math.random() * 300);

    // Randomly fail for demo purposes
    if (Math.random() < 0.1) {
      timer.end({ success: false, reason: 'gateway_timeout' });
      this.logger.error('Payment processing failed', {
        orderId,
        reason: 'Gateway timeout',
        stack: new Error('Payment gateway timeout').stack,
      });
      throw new BadRequestException('Payment processing failed');
    }

    timer.end({ success: true });
    this.logger.info('Payment processed successfully', { orderId });

    // Update order status
    await db.orders.updateStatus(orderId, 'confirmed');
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
