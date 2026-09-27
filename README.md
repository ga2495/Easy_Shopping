# ShopEase 🛒 — Full-Stack E-Commerce Platform

A clean, modern, full-stack e-commerce web application built with **Node.js**, **Express**, **MySQL**, and vanilla **HTML5 / CSS3 / JavaScript**.

---

## ✨ Features

### 🛍️ Customer
- **User Registration & Authentication**: Secure user registration and login with bcrypt password hashing and JWT token management.
- **Product Storefront**: Dynamic product catalog with real-time text search, category filtering, and stock indicators.
- **Shopping Cart**: Real-time quantity adjustments, stock limit validation, and order subtotal/shipping calculations.
- **Instant Buy Now & Cart Checkout**: Server-calculated pricing and stock reservation.
- **Razorpay Payments**: Secure payment gateway integration with HMAC SHA-256 cryptographic signature verification.
- **Order Management & Tracking**: View completed order history with status tracking and 24-hour order cancellation window (including automated inventory restoration and refund initiation).

### 🛡️ Admin
- **Role-Based Access Control (RBAC)**: Backend verification protecting admin APIs and dashboard operations.
- **Inventory Management**: Add new products, update existing product attributes (price, stock, category, description), and remove products.
- **Store Order Overview**: View all orders across all customers with status updating capabilities.

### 💳 Payments Integration
- Integrated with **Razorpay Checkout SDK**.
- **Optional for Local Development**: The backend server starts and functions normally even if Razorpay keys are not provided. When keys are omitted, browsing, cart, and authentication work seamlessly while payment endpoints return clear notification messages.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Modern CSS3 (Dark Mode / Glassmorphism), Vanilla JavaScript (ES6+)
- **Backend**: Node.js (v18+), Express.js (v5)
- **Database**: MySQL (Connection pooling, foreign keys, unique constraints, and atomic transactions)
- **Authentication**: JSON Web Tokens (JWT), bcrypt
- **Payment Gateway**: Razorpay (Test / Live modes)

---

## 📁 Project Structure

```
ecommerce-web-main/
├── backend/
│   ├── config/
│   │   ├── db.js              # MySQL connection pool configuration
│   │   └── razorpay.js        # Optional Razorpay SDK instance handler
│   ├── middleware/
│   │   └── auth.js            # JWT authentication & admin authorization
│   ├── routes/
│   │   ├── auth.js            # /auth (Register, Login, Me)
│   │   ├── categories.js      # /categories (Category tree & filtering)
│   │   ├── products.js        # /products (CRUD products & search)
│   │   ├── cart.js            # /cart (Add, update, remove, clear)
│   │   ├── orders.js          # /orders (Checkout, Buy Now, My Orders, Cancel)
│   │   └── payments.js        # /payments (Razorpay create & verify)
│   ├── database.sql           # Schema definition & local demo seed data
│   ├── setup-db.js            # Automated repeatable database setup script
│   ├── package.json           # Backend package configuration
│   └── server.js              # Express server & static asset handler
├── frontend/
│   ├── js/
│   │   └── config.js          # Dynamic API endpoint resolution
│   ├── index.html             # Smart router / loading landing page
│   ├── login.html             # Customer & Admin login portal
│   ├── register.html          # New customer registration portal
│   ├── products.html          # Product catalog, live search & admin modal
│   ├── cart.html              # Shopping cart & checkout
│   └── orders.html            # Order history & cancellation interface
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── package.json               # Root orchestration package
├── package-lock.json          # Dependency lockfile
└── README.md
```

---

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **MySQL**: v8.0 or compatible database server (Local or Cloud)

---

## 🚀 Installation & Local Setup

### 1. Clone & Install Dependencies

```bash
git clone <YOUR_REPOSITORY_URL>
cd ecommerce-web-main

npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure your local MySQL credentials in `.env`:

```env
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=shopease
DB_SSL=false

# JWT Secret Key
JWT_SECRET=your_jwt_secret_key_here

# Razorpay Credentials (Optional for local development)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

### 3. Database Initialization

Run the automated seeder script to create the `shopease` database, tables, relationships, indexes, and demo data:

```bash
npm run setup-db
```

### 4. Start the Application

```bash
npm start
```

Visit **`http://localhost:3000`** in your browser.

---

## 🔍 Health Check

Verify that the backend server is running and healthy:

```bash
GET http://localhost:3000/api/health
```

Expected Response:
```json
{
  "status": "ok",
  "message": "🛒 ShopEase API is running!"
}
```

---

## 🔑 Demo Credentials (LOCAL DEMO ONLY)

The automated database setup script generates the following test accounts:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@shop.com` | `password` |
| **Customer** | `user@shop.com` | `password` |

*(These accounts are intended for local development and demonstration purposes only.)*

---

## 💳 Payment Setup (Razorpay Test Mode)

To enable test payment processing:
1. Create a free account at [Razorpay](https://razorpay.com/).
2. Navigate to **Settings** → **API Keys** and generate **Test Keys**.
3. Add the keys to your `.env` file:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Restart the server (`npm start`).

### Razorpay Test Card Details:
```
Card Number : 5267 3181 8797 5449
Expiry      : 12/28
CVV         : 123
OTP         : 1234
```

---

## 🔒 Security Best Practices

- **Zero Hardcoded Secrets**: Secrets and database credentials are read strictly from environment variables.
- **Password Security**: All passwords are encrypted with bcrypt salt rounds prior to storage.
- **Role-Based Authorization**: Protected administrative routes verify JWT tokens and admin privileges server-side.
- **Stock Integrity**: Atomic SQL transactions and row locks prevent race conditions and duplicate stock deductions.
- **Client Sanitization**: Passwords and secret keys are never returned in API responses.

---

## 👤 Author

**Aman Gupta**
