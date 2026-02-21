/**
 * Mock Database - simulates async database operations with delays
 */

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
}

export interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Date;
}

export interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
}

export interface Notification {
  id: number;
  userId: number;
  type: 'email' | 'sms' | 'push';
  message: string;
  sentAt: Date;
}

// In-memory storage
const users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', password: 'hash123', createdAt: new Date() },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', password: 'hash456', createdAt: new Date() },
  { id: 3, name: 'Bob Wilson', email: 'bob@example.com', password: 'hash789', createdAt: new Date() },
];

const products: Product[] = [
  { id: 1, name: 'Laptop Pro', price: 1299.99, stock: 50, category: 'Electronics' },
  { id: 2, name: 'Wireless Mouse', price: 49.99, stock: 200, category: 'Electronics' },
  { id: 3, name: 'USB-C Hub', price: 79.99, stock: 0, category: 'Electronics' }, // Out of stock!
  { id: 4, name: 'Mechanical Keyboard', price: 149.99, stock: 75, category: 'Electronics' },
  { id: 5, name: 'Monitor 27"', price: 399.99, stock: 30, category: 'Electronics' },
];

const orders: Order[] = [
  {
    id: 1,
    userId: 1,
    items: [{ productId: 1, quantity: 1, price: 1299.99 }],
    status: 'delivered',
    total: 1299.99,
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: 2,
    userId: 2,
    items: [
      { productId: 2, quantity: 2, price: 49.99 },
      { productId: 4, quantity: 1, price: 149.99 },
    ],
    status: 'shipped',
    total: 249.97,
    createdAt: new Date(Date.now() - 3600000),
  },
];

const notifications: Notification[] = [];

// Simulate database delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Database operations
export const db = {
  users: {
    async findAll(): Promise<User[]> {
      await delay(30 + Math.random() * 50);
      return [...users];
    },
    async findById(id: number): Promise<User | undefined> {
      await delay(20 + Math.random() * 30);
      return users.find((u) => u.id === id);
    },
    async findByEmail(email: string): Promise<User | undefined> {
      await delay(25 + Math.random() * 35);
      return users.find((u) => u.email === email);
    },
    async create(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
      await delay(50 + Math.random() * 100);
      const user: User = {
        id: users.length + 1,
        ...data,
        createdAt: new Date(),
      };
      users.push(user);
      return user;
    },
    async update(id: number, data: Partial<User>): Promise<User | undefined> {
      await delay(40 + Math.random() * 60);
      const index = users.findIndex((u) => u.id === id);
      if (index === -1) return undefined;
      users[index] = { ...users[index], ...data };
      return users[index];
    },
  },

  products: {
    async findAll(): Promise<Product[]> {
      await delay(25 + Math.random() * 40);
      return [...products];
    },
    async findById(id: number): Promise<Product | undefined> {
      await delay(15 + Math.random() * 25);
      return products.find((p) => p.id === id);
    },
    async findByIds(ids: number[]): Promise<Product[]> {
      await delay(30 + Math.random() * 50);
      return products.filter((p) => ids.includes(p.id));
    },
    async create(data: Omit<Product, 'id'>): Promise<Product> {
      await delay(45 + Math.random() * 80);
      const product: Product = {
        id: products.length + 1,
        ...data,
      };
      products.push(product);
      return product;
    },
    async updateStock(id: number, quantity: number): Promise<boolean> {
      await delay(35 + Math.random() * 45);
      const product = products.find((p) => p.id === id);
      if (!product) return false;
      product.stock += quantity;
      return true;
    },
    async checkStock(id: number, quantity: number): Promise<boolean> {
      await delay(20 + Math.random() * 30);
      const product = products.find((p) => p.id === id);
      return product ? product.stock >= quantity : false;
    },
  },

  orders: {
    async findAll(): Promise<Order[]> {
      await delay(35 + Math.random() * 55);
      return [...orders];
    },
    async findById(id: number): Promise<Order | undefined> {
      await delay(20 + Math.random() * 30);
      return orders.find((o) => o.id === id);
    },
    async findByUserId(userId: number): Promise<Order[]> {
      await delay(30 + Math.random() * 45);
      return orders.filter((o) => o.userId === userId);
    },
    async create(data: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
      await delay(80 + Math.random() * 150);
      const order: Order = {
        id: orders.length + 1,
        ...data,
        createdAt: new Date(),
      };
      orders.push(order);
      return order;
    },
    async updateStatus(id: number, status: Order['status']): Promise<boolean> {
      await delay(40 + Math.random() * 60);
      const order = orders.find((o) => o.id === id);
      if (!order) return false;
      order.status = status;
      return true;
    },
  },

  notifications: {
    async create(data: Omit<Notification, 'id' | 'sentAt'>): Promise<Notification> {
      await delay(100 + Math.random() * 200); // Slower - external service
      const notification: Notification = {
        id: notifications.length + 1,
        ...data,
        sentAt: new Date(),
      };
      notifications.push(notification);
      return notification;
    },
    async findByUserId(userId: number): Promise<Notification[]> {
      await delay(25 + Math.random() * 35);
      return notifications.filter((n) => n.userId === userId);
    },
  },
};
