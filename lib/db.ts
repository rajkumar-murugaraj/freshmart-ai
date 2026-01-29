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

  // Products table with stock and cost_price
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
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
  // Add cost_price column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0`);
  } catch (e) { /* column already exists */ }
  // Add variant columns if they don't exist
  try {
    db.exec(`ALTER TABLE products ADD COLUMN variant_group TEXT`);
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE products ADD COLUMN variant_type TEXT`);
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE products ADD COLUMN variant_value TEXT`);
  } catch (e) { /* column already exists */ }

  // Add cashier_name column to sales table if it doesn't exist
  try {
    db.exec(`ALTER TABLE sales ADD COLUMN cashier_name TEXT`);
  } catch (e) { /* column already exists */ }

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

  // Order status history for tracking timeline
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Reviews table for product ratings
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Wishlists table for backend persistence
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      added_price REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
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
      // --- Vegetables (standalone) ---
      { name: 'Fresh Organic Spinach', price: 45, cost_price: 36, category: 'Vegetables', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=400', description: 'Crisp, green organic spinach leaves, perfect for salads and cooking.', unit: 'bunch', stock: 50, min_stock: 10, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Potato (Large)', price: 35, cost_price: 28, category: 'Vegetables', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400', description: 'Starchy large potatoes, ideal for fries and curries.', unit: 'kg', stock: 200, min_stock: 30, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Tomato (Hybrid)', price: 40, cost_price: 32, category: 'Vegetables', image: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?auto=format&fit=crop&q=80&w=400', description: 'Fresh hybrid tomatoes, firm and juicy for everyday cooking.', unit: 'kg', stock: 150, min_stock: 25, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Onion (Red)', price: 30, cost_price: 24, category: 'Vegetables', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=400', description: 'Pungent red onions, a staple in every Indian kitchen.', unit: 'kg', stock: 180, min_stock: 30, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Carrot (Ooty)', price: 55, cost_price: 44, category: 'Vegetables', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=400', description: 'Sweet and crunchy carrots from the Ooty hills.', unit: 'kg', stock: 80, min_stock: 15, variant_group: null, variant_type: null, variant_value: null },

      // --- Fruits (standalone) ---
      { name: 'Red Apple (Kashmir)', price: 180, cost_price: 144, category: 'Fruits', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400', description: 'Sweet and juicy red apples directly from Kashmir orchards.', unit: 'kg', stock: 100, min_stock: 20, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Bananas (Robusta)', price: 50, cost_price: 40, category: 'Fruits', image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&q=80&w=400', description: 'Ripe and sweet yellow bananas, rich in potassium.', unit: 'doz', stock: 60, min_stock: 10, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Mango (Alphonso)', price: 350, cost_price: 280, category: 'Fruits', image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400', description: 'Premium Alphonso mangoes, the king of fruits. Sweet and aromatic.', unit: 'kg', stock: 40, min_stock: 8, variant_group: null, variant_type: null, variant_value: null },

      // --- Bakery (standalone) ---
      { name: 'Whole Wheat Bread', price: 40, cost_price: 32, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400', description: 'Freshly baked whole wheat bread, high in fiber.', unit: 'pack', stock: 30, min_stock: 5, variant_group: null, variant_type: null, variant_value: null },
      { name: 'Butter Croissant', price: 60, cost_price: 48, category: 'Bakery', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038024a?auto=format&fit=crop&q=80&w=400', description: 'Flaky, buttery croissant baked fresh daily.', unit: 'pc', stock: 25, min_stock: 5, variant_group: null, variant_type: null, variant_value: null },

      // --- Dairy: Amul Milk (variant group) ---
      { name: 'Amul Milk - 500ml', price: 32, cost_price: 25.6, category: 'Dairy', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400', description: 'Farm fresh pasteurized full cream milk by Amul.', unit: 'pack', stock: 80, min_stock: 15, variant_group: 'amul-milk', variant_type: 'Volume', variant_value: '500ml' },
      { name: 'Amul Milk - 1L', price: 60, cost_price: 48, category: 'Dairy', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400', description: 'Farm fresh pasteurized full cream milk by Amul.', unit: 'pack', stock: 60, min_stock: 10, variant_group: 'amul-milk', variant_type: 'Volume', variant_value: '1L' },
      { name: 'Amul Milk - 2L', price: 110, cost_price: 88, category: 'Dairy', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400', description: 'Farm fresh pasteurized full cream milk by Amul.', unit: 'pack', stock: 40, min_stock: 8, variant_group: 'amul-milk', variant_type: 'Volume', variant_value: '2L' },

      // --- Dairy: Paneer (variant group) ---
      { name: 'Paneer - 200g', price: 80, cost_price: 64, category: 'Dairy', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=400', description: 'Fresh cottage cheese, soft and creamy. Perfect for curries and snacks.', unit: 'pack', stock: 50, min_stock: 10, variant_group: 'paneer', variant_type: 'Weight', variant_value: '200g' },
      { name: 'Paneer - 500g', price: 180, cost_price: 144, category: 'Dairy', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=400', description: 'Fresh cottage cheese, soft and creamy. Perfect for curries and snacks.', unit: 'pack', stock: 30, min_stock: 5, variant_group: 'paneer', variant_type: 'Weight', variant_value: '500g' },
      { name: 'Paneer - 1kg', price: 340, cost_price: 272, category: 'Dairy', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=400', description: 'Fresh cottage cheese, soft and creamy. Perfect for curries and snacks.', unit: 'pack', stock: 20, min_stock: 3, variant_group: 'paneer', variant_type: 'Weight', variant_value: '1kg' },

      // --- Beverages: Orange Juice (variant group) ---
      { name: 'Orange Juice - 200ml', price: 30, cost_price: 24, category: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400', description: '100% natural cold-pressed orange juice with pulp.', unit: 'pack', stock: 50, min_stock: 10, variant_group: 'orange-juice', variant_type: 'Volume', variant_value: '200ml' },
      { name: 'Orange Juice - 500ml', price: 65, cost_price: 52, category: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400', description: '100% natural cold-pressed orange juice with pulp.', unit: 'pack', stock: 35, min_stock: 7, variant_group: 'orange-juice', variant_type: 'Volume', variant_value: '500ml' },
      { name: 'Orange Juice - 1L', price: 120, cost_price: 96, category: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400', description: '100% natural cold-pressed orange juice with pulp.', unit: 'pack', stock: 25, min_stock: 5, variant_group: 'orange-juice', variant_type: 'Volume', variant_value: '1L' },

      // --- Beverages: Coca Cola (variant group) ---
      { name: 'Coca Cola - 300ml', price: 20, cost_price: 16, category: 'Beverages', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&q=80&w=400', description: 'Classic Coca Cola, ice-cold refreshment.', unit: 'bottle', stock: 100, min_stock: 20, variant_group: 'coca-cola', variant_type: 'Volume', variant_value: '300ml' },
      { name: 'Coca Cola - 750ml', price: 40, cost_price: 32, category: 'Beverages', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&q=80&w=400', description: 'Classic Coca Cola, ice-cold refreshment.', unit: 'bottle', stock: 60, min_stock: 10, variant_group: 'coca-cola', variant_type: 'Volume', variant_value: '750ml' },
      { name: 'Coca Cola - 2L', price: 90, cost_price: 72, category: 'Beverages', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&q=80&w=400', description: 'Classic Coca Cola, ice-cold refreshment. Family size bottle.', unit: 'bottle', stock: 30, min_stock: 5, variant_group: 'coca-cola', variant_type: 'Volume', variant_value: '2L' },

      // --- Snacks: Salted Chips (variant group) ---
      { name: 'Salted Chips - Small', price: 20, cost_price: 16, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=400', description: 'Classic salted potato chips, crispy and crunchy.', unit: 'pack', stock: 100, min_stock: 20, variant_group: 'salted-chips', variant_type: 'Size', variant_value: 'Small' },
      { name: 'Salted Chips - Large', price: 50, cost_price: 40, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=400', description: 'Classic salted potato chips, crispy and crunchy. Family size pack.', unit: 'pack', stock: 60, min_stock: 10, variant_group: 'salted-chips', variant_type: 'Size', variant_value: 'Large' },
      { name: 'Salted Chips - Party Pack', price: 99, cost_price: 79.2, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=400', description: 'Classic salted potato chips, crispy and crunchy. Party pack for gatherings.', unit: 'pack', stock: 30, min_stock: 5, variant_group: 'salted-chips', variant_type: 'Size', variant_value: 'Party Pack' },
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (name, price, cost_price, category, image, description, unit, stock, min_stock, variant_group, variant_type, variant_value)
      VALUES (@name, @price, @cost_price, @category, @image, @description, @unit, @stock, @min_stock, @variant_group, @variant_type, @variant_value)
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
