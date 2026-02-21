import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ProductService } from './product.service';
import { devLogger } from '../../../..';

@Controller('products')
export class ProductController {
  private logger = devLogger.create('ProductController', 'nest');

  constructor(private productService: ProductService) {}

  @Get()
  async findAll() {
    this.logger.info('GET /products');
    return this.productService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.info('GET /products/:id', { id });
    return this.productService.findById(id);
  }

  @Post()
  async create(
    @Body() body: { name: string; price: number; stock: number; category: string }
  ) {
    this.logger.info('POST /products', { name: body.name });
    return this.productService.create(body);
  }
}
