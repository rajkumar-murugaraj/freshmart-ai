require('dotenv').config();

// Skip DB initialization during Next.js build-time route analysis
// (parallel workers cause SQLITE_BUSY when collecting page data)
if (process.env.NEXT_PHASE === 'phase-production-build') {
  const noop = () => {};
  const stub = {
    get: (sql, params, cb) => cb && cb(null, undefined),
    all: (sql, params, cb) => cb && cb(null, []),
    run: (sql, params, cb) => cb && cb(null),
    serialize: (fn) => fn && fn(),
    prepare: () => ({ run: noop, finalize: noop }),
    close: noop,
  };
  module.exports = stub;
  return;
}

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase();

if (DB_TYPE === 'mysql') {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'freshmart',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const setupSQL = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      phone TEXT,
      address TEXT
    ) ENGINE=InnoDB;`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name TEXT,
      price DOUBLE,
      category TEXT,
      image TEXT,
      description TEXT,
      unit TEXT
    ) ENGINE=InnoDB;`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      total DOUBLE,
      date TEXT,
      status TEXT,
      payment_method TEXT,
      shipping_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB;`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      order_id INT,
      product_id INT,
      name TEXT,
      quantity INT,
      price DOUBLE,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    ) ENGINE=InnoDB;`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      is_admin INT DEFAULT 0,
      message TEXT,
      meta TEXT,
      read INT DEFAULT 0,
      created_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB;`
  ];

  (async function initMySQL() {
    try {
      for (const s of setupSQL) {
        await pool.execute(s);
      }

      const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", ['admin@freshmart.com']);
      if (!rows || rows.length === 0) {
        await pool.execute("INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)", ['Super Admin', 'admin@freshmart.com', 'admin123', 'admin', '9999999999']);
        console.log('Admin user created: admin@freshmart.com / admin123');
      }

      const [pcount] = await pool.execute("SELECT COUNT(*) as count FROM products");
      if (pcount && pcount[0] && pcount[0].count === 0) {
        const initialProducts = [
          ['Fresh Organic Spinach', 45, 'Vegetables', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=400', 'Crisp, green organic spinach leaves.', 'bunch'],
          ['Red Apple (Kashmir)', 180, 'Fruits', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400', 'Sweet and juicy red apples.', 'kg'],
          ['Full Cream Milk', 64, 'Dairy', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400', 'Farm fresh pasteurized milk.', 'liter'],
          ['Whole Wheat Bread', 40, 'Bakery', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400', 'Freshly baked bread.', 'pack']
        ];
        for (const prod of initialProducts) {
          await pool.execute("INSERT INTO products (name, price, category, image, description, unit) VALUES (?, ?, ?, ?, ?, ?)", prod);
        }
        console.log('Initial products seeded.');
      }
    } catch (e) {
      console.error('MySQL init error:', e);
    }
  })();

  const db = {
    async get(sql, params, cb) {
      try {
        const [rows] = await pool.execute(sql, params || []);
        const row = rows && rows.length ? rows[0] : undefined;
        if (typeof cb === 'function') return cb(null, row);
        return row;
      } catch (err) {
        if (typeof cb === 'function') return cb(err);
        throw err;
      }
    },
    async all(sql, params, cb) {
      try {
        const [rows] = await pool.execute(sql, params || []);
        if (typeof cb === 'function') return cb(null, rows);
        return rows;
      } catch (err) {
        if (typeof cb === 'function') return cb(err);
        throw err;
      }
    },
    async run(sql, params, cb) {
      try {
        const [result] = await pool.execute(sql, params || []);
        const ctx = { lastID: result.insertId || null, changes: result.affectedRows || 0 };
        if (typeof cb === 'function') return cb.call(ctx, null);
        return ctx;
      } catch (err) {
        if (typeof cb === 'function') return cb(err);
        throw err;
      }
    },
    prepare(sql) {
      return {
        async run(...params) {
          let cb = null;
          if (params.length && typeof params[params.length - 1] === 'function') {
            cb = params.pop();
          }
          try {
            const [result] = await pool.execute(sql, params || []);
            if (cb) return cb.call({ lastID: result.insertId || null });
            return { lastID: result.insertId || null };
          } catch (e) {
            if (cb) return cb(e);
            throw e;
          }
        },
        finalize() { }
      };
    }
  };

  module.exports = db;
  return;
}

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.SQLITE_PATH
  || (process.env.NODE_ENV === 'production' ? './freshmart.db' : './grocery.db');

const dbDir = path.dirname(DB_PATH);
if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    phone TEXT,
    address TEXT
  )`);

  // Products Table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    category TEXT,
    image TEXT,
    description TEXT,
    unit TEXT
  )`);

  // Orders Table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total REAL,
    date TEXT,
    status TEXT,
    payment_method TEXT,
    shipping_address TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Order Items Table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    name TEXT,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);

  // Notifications Table
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    is_admin INTEGER DEFAULT 0,
    message TEXT,
    meta TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Seed Admin User
  db.get("SELECT * FROM users WHERE email = 'admin@freshmart.com'", (err, row) => {
    if (!row) {
      db.run(`INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)`, 
      ['Super Admin', 'admin@freshmart.com', 'admin123', 'admin', '9999999999']);
      console.log("Admin user created: admin@freshmart.com / admin123");
    }
  });

  // Seed Initial Products
  db.get("SELECT count(*) as count FROM products", (err, row) => {
    if (row.count === 0) {
      const initialProducts = [
        ['Fresh Organic Spinach', 45, 'Vegetables', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=400', 'Crisp, green organic spinach leaves.', 'bunch'],
        ['Red Apple (Kashmir)', 180, 'Fruits', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400', 'Sweet and juicy red apples.', 'kg'],
        ['Full Cream Milk', 64, 'Dairy', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400', 'Farm fresh pasteurized milk.', 'liter'],
        ['Whole Wheat Bread', 40, 'Bakery', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400', 'Freshly baked bread.', 'pack']
      ];
      
      const stmt = db.prepare("INSERT INTO products (name, price, category, image, description, unit) VALUES (?, ?, ?, ?, ?, ?)");
      initialProducts.forEach(prod => stmt.run(prod));
      stmt.finalize();
      console.log("Initial products seeded.");
    }
  });
});

module.exports = db;