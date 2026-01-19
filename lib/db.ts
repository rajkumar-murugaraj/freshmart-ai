import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'freshmart.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      phone TEXT,
      address TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table with stock
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      image TEXT,
      description TEXT,
      unit TEXT DEFAULT 'kg',
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 10,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add stock columns if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0`);
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 10`);
  } catch (e) { /* column already exists */ }

  // Fix products with 0 stock - set a default stock value for existing products
  const zeroStockProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock = 0 OR stock IS NULL').get() as { count: number };
  if (zeroStockProducts.count > 0) {
    db.exec(`UPDATE products SET stock = 50, min_stock = 10 WHERE stock = 0 OR stock IS NULL`);
    console.log(`Updated ${zeroStockProducts.count} products with default stock values`);
  }

  // Stock transactions table for tracking stock changes
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      reference_id TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      shipping_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Order items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      is_admin INTEGER DEFAULT 0,
      message TEXT NOT NULL,
      meta TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sales table for POS transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      customer_id INTEGER,
      cashier_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    )
  `);

  // Sale items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Seed admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@freshmart.com');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run('Admin', 'admin@freshmart.com', hashedPassword, 'admin', '9999999999');
  }

  // Seed sales user if not exists
  const salesExists = db.prepare('SELECT id FROM users WHERE email = ?').get('sales@freshmart.com');
  if (!salesExists) {
    const hashedPassword = bcrypt.hashSync('sales123', 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run('Sales Staff', 'sales@freshmart.com', hashedPassword, 'sales', '8888888888');
  }

  // Seed initial products if table is empty
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    const initialProducts = [
      {
        name: 'Fresh Organic Spinach',
        price: 45,
        category: 'Vegetables',
        image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=400',
        description: 'Crisp, green organic spinach leaves, perfect for salads and cooking.',
        unit: 'bunch',
        stock: 50,
        min_stock: 10
      },
      {
        name: 'Red Apple (Kashmir)',
        price: 180,
        category: 'Fruits',
        image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400',
        description: 'Sweet and juicy red apples directly from Kashmir orchards.',
        unit: 'kg',
        stock: 100,
        min_stock: 20
      },
      {
        name: 'Whole Wheat Bread',
        price: 40,
        category: 'Bakery',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400',
        description: 'Freshly baked whole wheat bread, high in fiber.',
        unit: 'pack',
        stock: 30,
        min_stock: 5
      },
      {
        name: 'Full Cream Milk',
        price: 64,
        category: 'Dairy',
        image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400',
        description: 'Farm fresh pasteurized full cream milk.',
        unit: 'liter',
        stock: 80,
        min_stock: 15
      },
      {
        name: 'Potato (Large)',
        price: 35,
        category: 'Vegetables',
        image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400',
        description: 'Starchy large potatoes, ideal for fries and curries.',
        unit: 'kg',
        stock: 200,
        min_stock: 30
      },
      {
        name: 'Bananas (Robusta)',
        price: 50,
        category: 'Fruits',
        image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&q=80&w=400',
        description: 'Ripe and sweet yellow bananas, rich in potassium.',
        unit: 'doz',
        stock: 60,
        min_stock: 10
      },
      {
        name: 'Orange Juice',
        price: 120,
        category: 'Beverages',
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
        description: '100% natural cold-pressed orange juice with pulp.',
        unit: 'liter',
        stock: 25,
        min_stock: 5
      },
      {
        name: 'Salted Chips',
        price: 20,
        category: 'Snacks',
        image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=400',
        description: 'Classic salted potato chips, crispy and crunchy.',
        unit: 'pack',
        stock: 100,
        min_stock: 20
      }
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (name, price, category, image, description, unit, stock, min_stock)
      VALUES (@name, @price, @category, @image, @description, @unit, @stock, @min_stock)
    `);

    for (const product of initialProducts) {
      insertProduct.run(product);
    }
  }

  console.log('Database initialized successfully');
}

// Initialize on module load
initializeDatabase();

export default db;
