import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { devLogger } from '../../../..';
import { db, Product } from '../../shared/database';

@Injectable()
export class ProductService {
  private logger = devLogger.create('ProductService', 'nest');

  async findAll(): Promise<Product[]> {
    this.logger.info('Fetching all products');

    const timer = this.logger.startTimer('db-query-products');
    const products = await db.products.findAll();
    timer.end({ count: products.length });

    return products;
  }

  async findById(id: number): Promise<Product> {
    this.logger.info('Finding product by ID', { id });

    const timer = this.logger.startTimer('db-query-product');
    const product = await db.products.findById(id);
    timer.end({ found: !!product });

    if (!product) {
      this.logger.warn('Product not found', { id });
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    this.logger.debug('Product found', { id, name: product.name, stock: product.stock });
    return product;
  }

  async findByIds(ids: number[]): Promise<Product[]> {
    this.logger.debug('Finding products by IDs', { ids, count: ids.length });

    const timer = this.logger.startTimer('db-query-products-batch');
    const products = await db.products.findByIds(ids);
    timer.end({ requested: ids.length, found: products.length });

    return products;
  }

  async create(data: { name: string; price: number; stock: number; category: string }): Promise<Product> {
    this.logger.info('Creating new product', { name: data.name, category: data.category });

    const timer = this.logger.startTimer('db-insert-product');
    const product = await db.products.create(data);
    timer.end({ productId: product.id });

    this.logger.info('Product created successfully', { productId: product.id });
    return product;
  }

  async checkAndReserveStock(productId: number, quantity: number): Promise<void> {
    this.logger.debug('Checking stock availability', { productId, quantity });

    const timer = this.logger.startTimer('stock-check');
    const available = await db.products.checkStock(productId, quantity);
    timer.end({ available });

    if (!available) {
      const product = await db.products.findById(productId);
      this.logger.error('Insufficient stock', {
        productId,
        productName: product?.name,
        requested: quantity,
        available: product?.stock || 0,
      });
      throw new BadRequestException(
        `Insufficient stock for product ${productId}. Requested: ${quantity}, Available: ${product?.stock || 0}`
      );
    }

    // Reserve stock (decrease)
    this.logger.debug('Reserving stock', { productId, quantity });
    const updateTimer = this.logger.startTimer('stock-update');
    await db.products.updateStock(productId, -quantity);
    updateTimer.end();

    this.logger.info('Stock reserved successfully', { productId, quantity });
  }

  async releaseStock(productId: number, quantity: number): Promise<void> {
    this.logger.info('Releasing reserved stock', { productId, quantity });

    const timer = this.logger.startTimer('stock-release');
    await db.products.updateStock(productId, quantity);
    timer.end();

    this.logger.debug('Stock released', { productId, quantity });
  }

  async calculateTotalPrice(items: { productId: number; quantity: number }[]): Promise<number> {
    this.logger.debug('Calculating total price', { itemCount: items.length });

    const productIds = items.map((i) => i.productId);
    const products = await this.findByIds(productIds);

    let total = 0;
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        total += product.price * item.quantity;
      }
    }

    this.logger.debug('Total calculated', { total, itemCount: items.length });
    return Math.round(total * 100) / 100;
  }
}
