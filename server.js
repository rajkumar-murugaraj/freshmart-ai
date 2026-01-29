require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Request Logger Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- Auth Routes ---

app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  
  // If role is specified (e.g., admin), we can enforce it in the query, 
  // or check it after retrieval. Here we check after to give better error messages.
  
  db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
    if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
    }
    
    // Strict Admin Check if logging in via Admin Portal
    if (role === 'admin' && user.role !== 'admin') {
        return res.status(403).json({ error: "Access Denied: Not an Administrator" });
    }

    res.json(user);
  });
});

app.post('/api/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  
  // Default role is 'user'. Admins are created via DB seed or manual SQL only for security.
  const role = 'user'; 

  db.run("INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)", [name, email, password, role, phone], function(err) {
    if (err) {
        console.error("Register Error:", err);
        return res.status(400).json({ error: "Email likely already exists" });
    }
    
    db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err, user) => {
      res.json(user);
    });
  });
});

app.put('/api/users/:id', (req, res) => {
    const { addresses } = req.body;
    const userId = req.params.id;
    db.run("UPDATE users SET address = ? WHERE id = ?", [JSON.stringify(addresses), userId], (err) => {
        if (err) return res.status(500).json({error: err.message});
        res.json({success: true});
    });
});

// --- Product Routes ---

app.get('/api/products', (req, res) => {
  db.all("SELECT * FROM products ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', (req, res) => {
  const { name, price, category, image, description, unit } = req.body;
  db.run("INSERT INTO products (name, price, category, image, description, unit) VALUES (?, ?, ?, ?, ?, ?)",
    [name, price, category, image, description, unit], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/products/:id', (req, res) => {
  const { name, price, category, image, description, unit } = req.body;
  db.run("UPDATE products SET name=?, price=?, category=?, image=?, description=?, unit=? WHERE id=?",
    [name, price, category, image, description, unit, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

app.delete('/api/products/:id', (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Order Routes ---

app.get('/api/orders', (req, res) => {
  const userId = req.query.userId;
  const isAdmin = req.query.isAdmin === 'true';

  let query = "SELECT orders.*, users.name as user_name, users.email as user_email, users.phone as user_phone FROM orders JOIN users ON orders.user_id = users.id";
  let params = [];

  if (!isAdmin && userId) {
    query += " WHERE user_id = ?";
    params.push(userId);
  }
  
  query += " ORDER BY orders.date DESC";

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Parse JSON shipping addresses
    const orders = rows.map(order => {
        let shippingAddress = {};
        try {
            shippingAddress = JSON.parse(order.shipping_address || '{}');
        } catch(e) {}
        return { ...order, shippingAddress };
    });

    // Fetch items for these orders
    if (orders.length === 0) return res.json([]);

    const promises = orders.map(order => {
        return new Promise((resolve) => {
            db.all("SELECT * FROM order_items WHERE order_id = ?", [order.id], (err, items) => {
                order.items = items || [];
                resolve(order);
            });
        });
    });

    Promise.all(promises).then(completedOrders => res.json(completedOrders));
  });
});

app.post('/api/orders', (req, res) => {
  const { user_id, total, items, paymentMethod, shippingAddress } = req.body;
  const date = new Date().toISOString();
  
  db.run("INSERT INTO orders (user_id, total, date, status, payment_method, shipping_address) VALUES (?, ?, ?, ?, ?, ?)",
    [user_id, total, date, 'pending', paymentMethod, JSON.stringify(shippingAddress)], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const orderId = this.lastID;

      const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)");
      items.forEach(item => {
        stmt.run(orderId, item.id, item.name, item.quantity, item.price);
      });
      stmt.finalize();

      const order = {
        id: orderId,
        user_id,
        total,
        date,
        status: 'pending',
        paymentMethod,
        shippingAddress,
        items
      };

      // Try to fetch user email (if user_id provided)
      if (user_id) {
        db.get("SELECT email, name, phone FROM users WHERE id = ?", [user_id], (err, userRow) => {
          // Respond to client immediately
          res.json({ id: orderId, status: 'pending' });

          const customerEmail = userRow && userRow.email ? userRow.email : null;
          const customerName = userRow && userRow.name ? userRow.name : (shippingAddress && shippingAddress.name ? shippingAddress.name : 'Customer');
          const customerPhone = userRow && userRow.phone ? userRow.phone : (shippingAddress && shippingAddress.phone ? shippingAddress.phone : '');

          // Create notifications (persisted) for admin and customer
          createNotification({ is_admin: 1, message: `New order #${orderId} by ${customerName} — ₹${total}`, meta: JSON.stringify({ orderId, userId: user_id }) });
          createNotification({ user_id: user_id, is_admin: 0, message: `Your order #${orderId} has been placed. Total: ₹${total}`, meta: JSON.stringify({ orderId }) });

          // Send emails/SMS (non-blocking; respects SEND_EMAILS/SEND_SMS flags)
          sendOrderEmails(order, customerEmail, customerName, customerPhone);
        });
      } else {
        // Guest order - respond and create admin notification
        res.json({ id: orderId, status: 'pending' });
        const customerName = shippingAddress && shippingAddress.name ? shippingAddress.name : 'Guest';
        createNotification({ is_admin: 1, message: `New guest order #${orderId} by ${customerName} — ₹${total}`, meta: JSON.stringify({ orderId }) });
        const customerPhone = shippingAddress && shippingAddress.phone ? shippingAddress.phone : '';
        // Still call sendOrderEmails for backward compatibility (it won't send unless enabled)
        sendOrderEmails(order, null, customerName, customerPhone);
      }
    });
});

// Notifications API
app.get('/api/notifications', (req, res) => {
  const userId = req.query.userId;
  const isAdmin = req.query.isAdmin === 'true';

  if (isAdmin) {
    db.all("SELECT * FROM notifications WHERE is_admin = 1 ORDER BY created_at DESC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
    return;
  }

  if (!userId) return res.status(400).json({ error: 'userId required' });
  db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/notifications', (req, res) => {
  const { user_id, is_admin, message, meta } = req.body;
  const created_at = new Date().toISOString();
  db.run("INSERT INTO notifications (user_id, is_admin, message, meta, read, created_at) VALUES (?, ?, ?, ?, 0, ?)", [user_id || null, is_admin ? 1 : 0, message, meta || null, created_at], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT * FROM notifications WHERE id = ?", [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

app.put('/api/notifications/:id/read', (req, res) => {
  const id = req.params.id;
  db.run("UPDATE notifications SET read = 1 WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/notifications/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM notifications WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

function createNotification({ user_id, is_admin = 0, message, meta = null }) {
  const created_at = new Date().toISOString();
  db.run("INSERT INTO notifications (user_id, is_admin, message, meta, read, created_at) VALUES (?, ?, ?, ?, 0, ?)", [user_id || null, is_admin ? 1 : 0, message, meta || null, created_at], function(err) {
    if (err) return console.error('Failed to create notification:', err);
    console.log('Notification created id=', this.lastID, 'admin=', is_admin, 'user_id=', user_id);
    // Emit real-time socket notification to connected clients
    try {
      if (io) {
        io.emit('notification', { id: this.lastID, user_id: user_id || null, is_admin: is_admin ? 1 : 0, message, meta, created_at });
      }
    } catch (e) {
      console.error('Failed to emit socket notification', e);
    }
  });
}

// Test SMS endpoint: send a test SMS to the provided `phone` or to ADMIN_SMS
app.post('/api/test-sms', (req, res) => {
  const { phone } = req.body || {};
  const testOrder = {
    id: 'TEST-' + Date.now(),
    total: 1,
    items: [{ id: 'test', name: 'Test Product', quantity: 1, price: 1 }],
    paymentMethod: 'cod',
    shippingAddress: { name: 'Test', phone: phone || process.env.ADMIN_SMS || '9342277609' }
  };

  // Call the same helper to send SMS (it will log or send via Twilio depending on config)
  try {
    sendOrderEmails(testOrder, null, testOrder.shippingAddress.name, testOrder.shippingAddress.phone);
    res.json({ success: true, to: testOrder.shippingAddress.phone });
  } catch (e) {
    console.error('Test SMS error:', e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Helper: send order emails to admin and optionally to customer
function sendOrderEmails(order, customerEmail, customerName, customerPhone) {
  // Modernized: support SMS via Twilio and disable emails by default.
  const SEND_EMAILS = process.env.SEND_EMAILS === 'true';
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@freshmart.com';

  // Twilio config
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_FROM; // e.g. +1234567890
  const ADMIN_SMS = process.env.ADMIN_SMS || '9342277609';
  const SEND_SMS = process.env.SEND_SMS === 'true';

  // Normalizer: ensure E.164 for Indian 10-digit numbers
  const normalizePhone = (p) => {
    if (!p) return null;
    const s = String(p).trim();
    if (s.startsWith('+')) return s;
    // If 10 digits, assume +91
    if (/^\d{10}$/.test(s)) return '+91' + s;
    return s;
  };

  const adminSmsTo = normalizePhone(ADMIN_SMS);
  const customerSmsTo = normalizePhone(customerPhone);

  // Prepare message body
  const itemsText = (order.items || []).map(i => `${i.name} — ${i.quantity} × ₹${i.price}`).join('\n');
  const smsBody = `New order #${order.id} — Total: ₹${order.total}\nCustomer: ${customerName}\nPhone: ${customerPhone}\nItems:\n${itemsText}`;

  // Send SMS via Twilio only if explicitly enabled via SEND_SMS=true
  if (SEND_SMS) {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM) {
      try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        // Admin SMS
        if (adminSmsTo) {
          client.messages.create({ body: smsBody, from: TWILIO_FROM, to: adminSmsTo })
            .then(m => console.log('Admin SMS sent:', m.sid))
            .catch(err => console.error('Error sending admin SMS:', err));
        }
        // Customer SMS
        if (customerSmsTo) {
          client.messages.create({ body: `Thanks ${customerName}! Your order #${order.id} of ₹${order.total} is received.`, from: TWILIO_FROM, to: customerSmsTo })
            .then(m => console.log('Customer SMS sent:', m.sid))
            .catch(err => console.error('Error sending customer SMS:', err));
        }
      } catch (e) {
        console.error('Twilio send error:', e);
      }
    } else {
      // Twilio not configured — log payloads
      console.warn('SEND_SMS=true but Twilio not fully configured. SMS payloads will be logged.');
      console.log('Admin SMS to:', adminSmsTo, 'body:', smsBody);
      if (customerSmsTo) console.log('Customer SMS to:', customerSmsTo, 'body:', `Thanks ${customerName}! Your order #${order.id} of ₹${order.total} is received.`);
    }
  } else {
    // SMS explicitly disabled — only log notification payloads
    console.log('SMS sending disabled (SEND_SMS!=true). Notification payloads:');
    console.log('Admin SMS to:', adminSmsTo, 'body:', smsBody);
    if (customerSmsTo) console.log('Customer SMS to:', customerSmsTo, 'body:', `Thanks ${customerName}! Your order #${order.id} of ₹${order.total} is received.`);
  }

  // Emails are disabled unless explicitly enabled via SEND_EMAILS=true
  if (!SEND_EMAILS) return;

  // If emails are enabled, prefer SendGrid (no SMTP) when configured
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'no-reply@freshmart.local';

  const itemsHtml = (order.items || []).map(i => `<li>${i.name} — ${i.quantity} × ₹${i.price}</li>`).join('');
  const adminSubject = `New Order #${order.id} — FreshMart`;
  const adminHtml = `
    <h2>New Order Received — #${order.id}</h2>
    <p><strong>Customer:</strong> ${customerName} (${customerEmail || 'No email provided'})</p>
    <p><strong>Phone:</strong> ${customerPhone}</p>
    <p><strong>Payment:</strong> ${order.paymentMethod}</p>
    <p><strong>Total:</strong> ₹${order.total}</p>
    <p><strong>Shipping Address:</strong></p>
    <pre>${JSON.stringify(order.shippingAddress, null, 2)}</pre>
    <p><strong>Items:</strong></p>
    <ul>${itemsHtml}</ul>
  `;
  const customerSubject = `Your FreshMart Order #${order.id} — Received`;
  const customerHtml = `
    <h2>Thanks for your order, ${customerName}!</h2>
    <p>We've received your order <strong>#${order.id}</strong> and it's now being processed.</p>
    <p><strong>Payment:</strong> ${order.paymentMethod}</p>
    <p><strong>Total:</strong> ₹${order.total}</p>
    <p><strong>Shipping Address:</strong></p>
    <pre>${JSON.stringify(order.shippingAddress, null, 2)}</pre>
    <p><strong>Items:</strong></p>
    <ul>${itemsHtml}</ul>
    <p>We'll notify you when your order ships.</p>
  `;

  if (SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(SENDGRID_API_KEY);

      sgMail.send({ to: ADMIN_EMAIL, from: FROM_EMAIL, subject: adminSubject, html: adminHtml })
        .then(() => console.log('Admin email sent via SendGrid'))
        .catch(err => console.error('SendGrid admin send error:', err));

      if (customerEmail) {
        sgMail.send({ to: customerEmail, from: FROM_EMAIL, subject: customerSubject, html: customerHtml })
          .then(() => console.log('Customer email sent via SendGrid'))
          .catch(err => console.error('SendGrid customer send error:', err));
      }
    } catch (e) {
      console.error('SendGrid error:', e);
    }
    return;
  }

  // Fallback to Nodemailer SMTP transport
  let transporter;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: SMTP_PORT == 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    console.warn('SMTP not configured. Emails will be logged to console instead of sent.');
  }

  transporter.sendMail({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject: adminSubject, html: adminHtml }, (err, info) => {
    if (err) console.error('Error sending admin email:', err);
    else console.log('Admin email sent:', info && info.messageId ? info.messageId : info);
  });
  if (customerEmail) {
    transporter.sendMail({ from: FROM_EMAIL, to: customerEmail, subject: customerSubject, html: customerHtml }, (err, info) => {
      if (err) console.error('Error sending customer email:', err);
      else console.log('Customer email sent:', info && info.messageId ? info.messageId : info);
    });
  }
}

app.put('/api/orders/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({success: true});
    });
});

// Notify all users (for testing)
app.post('/api/notify-all', (req, res) => {
  const { message } = req.body;
  db.all("SELECT * FROM users", [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    
    users.forEach(user => {
      createNotification({ user_id: user.id, message, is_admin: 0 });
    });
    
    res.json({ success: true, notified: users.length });
  });
});

// Create HTTP server and attach Socket.IO for real-time notifications
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

// io will be assigned after server is created so createNotification can emit
let io = null;

// Socket bridge endpoint - allows Next.js API routes to emit socket events
app.post('/api/socket/emit', (req, res) => {
  const { event, data } = req.body;
  if (!event) {
    return res.status(400).json({ error: 'Event name required' });
  }
  if (io) {
    io.emit(event, data);
    console.log(`Socket event emitted: ${event}`, data);
    res.json({ success: true, event });
  } else {
    res.status(503).json({ error: 'Socket.IO not initialized' });
  }
});

// Socket bridge for order notifications specifically
app.post('/api/socket/order-notification', (req, res) => {
  const { orderId, customerName, total, userId } = req.body;
  if (io) {
    // Emit to admin listeners
    io.emit('new_order', { orderId, customerName, total, userId, timestamp: new Date().toISOString() });
    // Also emit as notification for backward compatibility
    io.emit('notification', {
      type: 'new_order',
      message: `New order #${orderId} from ${customerName} - ₹${total}`,
      orderId,
      timestamp: new Date().toISOString()
    });
    console.log(`Order notification emitted for order #${orderId}`);
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'Socket.IO not initialized' });
  }
});

// Socket bridge for stock update events
app.post('/api/socket/stock-update', (req, res) => {
  const { productId, productName, oldStock, newStock, type } = req.body;
  if (io) {
    const data = { productId, productName, oldStock, newStock, type, timestamp: new Date().toISOString() };
    io.emit('stock_update', data);
    console.log(`Stock update event emitted for product #${productId} (${productName}):`, data);
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'Socket.IO not initialized' });
  }
});

// Socket bridge for order status update events
app.post('/api/socket/order-status', (req, res) => {
  const { orderId, status, note, userId } = req.body;
  if (io) {
    const data = { orderId, status, note, userId, timestamp: new Date().toISOString() };
    io.emit('order_status_update', data);
    console.log(`Order status update event emitted for order #${orderId}: ${status}`);
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'Socket.IO not initialized' });
  }
});

server.listen(PORT, () => {
  console.log(`✅ Backend Server running on http://localhost:${PORT}`);
  try {
    io = new Server(server, { cors: { origin: '*' } });
    io.on('connection', (socket) => {
      console.log('Socket connected:', socket.id);
      socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
    });
  } catch (e) {
    console.error('Failed to initialize Socket.IO', e);
  }
});