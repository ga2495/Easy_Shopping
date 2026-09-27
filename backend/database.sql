-- ============================================================
-- ShopEase — E-COMMERCE DATABASE SETUP
-- Compatible with Local MySQL, Railway, TiDB Cloud, and Aiven
-- ============================================================

-- ── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(100) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
);

-- ── CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  parent_id    INT DEFAULT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_categories_parent (parent_id)
);

-- ── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2) NOT NULL,
  stock        INT NOT NULL DEFAULT 0,
  image_url    VARCHAR(500),
  category_id  INT DEFAULT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CHECK (price >= 0),
  CHECK (stock >= 0),
  INDEX idx_products_category (category_id),
  INDEX idx_products_name (name)
);

-- ── CART ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  product_id   INT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cart_user_product (user_id, product_id),
  CHECK (quantity > 0),
  INDEX idx_cart_user (user_id)
);

-- ── ORDERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  total               DECIMAL(10,2) NOT NULL,
  status              ENUM('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  payment_status      ENUM('unpaid','paid','refunded','refund_initiated') NOT NULL DEFAULT 'unpaid',
  razorpay_order_id   VARCHAR(100) DEFAULT NULL,
  razorpay_payment_id VARCHAR(100) DEFAULT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_payment_status (payment_status)
);

-- ── ORDER ITEMS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CHECK (quantity > 0),
  CHECK (price >= 0),
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id)
);

-- ── DEMO SEED DATA (LOCAL DEMO ONLY) ───────────────────────

-- Categories
INSERT IGNORE INTO categories (id, name, parent_id) VALUES
  (1, 'Electronics', NULL),
  (2, 'Fashion', NULL),
  (3, 'Mobiles', 1),
  (4, 'Laptops', 1),
  (5, 'Men''s Clothing', 2),
  (6, 'Women''s Clothing', 2);

-- Products
INSERT IGNORE INTO products (id, name, description, price, stock, category_id) VALUES
  (1, 'iPhone 14', 'Apple smartphone 128GB - Super Retina XDR display with A15 Bionic chip.', 79999.00, 50, 3),
  (2, 'Samsung Galaxy S23', 'Android flagship phone - Dynamic AMOLED 2X with Snapdragon 8 Gen 2.', 69999.00, 40, 3),
  (3, 'Dell Inspiron 15', 'Core i5 laptop with 16GB RAM and 512GB NVMe SSD.', 55000.00, 20, 4),
  (4, 'Men''s T-Shirt', '100% Premium Combed Cotton Round Neck Regular Fit T-shirt.', 499.00, 100, 5),
  (5, 'Women''s Kurti', 'Floral print breathable cotton ethnic straight kurti.', 799.00, 80, 6);

-- Demo Admin user (LOCAL DEMO ONLY: email: admin@shop.com | password: password)
INSERT IGNORE INTO users (id, name, email, password, role) VALUES
  (1, 'Admin User', 'admin@shop.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Demo Customer user (LOCAL DEMO ONLY: email: user@shop.com | password: password)
INSERT IGNORE INTO users (id, name, email, password, role) VALUES
  (2, 'Demo Customer', 'user@shop.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer');