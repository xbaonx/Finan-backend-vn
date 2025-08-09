# Finan Wallet Backend

Backend API server for Finan Wallet - handles deposit/withdraw orders and swap fee configuration.

## Features

### 🏦 Deposit/Withdraw Management
- **Order Storage**: Store deposit/withdraw requests with wallet address, amounts, transaction info
- **Manual Processing**: Orders are processed manually by admin
- **Exchange Rates**: Configurable USD/VND exchange rates
- **Order Tracking**: Track order status (pending, completed, failed, cancelled)

### 💱 Swap Configuration
- **Platform Fee Management**: Configurable swap fees (default 0.7%)
- **Rate Integration**: Uses deposit/withdraw exchange rates for swap calculations
- **Token Management**: Configure supported tokens for swapping
- **Fee Calculation**: API endpoints for fee calculation and validation

### 🔐 Admin Panel
- **JWT Authentication**: Secure admin login with JWT tokens
- **Order Management**: View and update order statuses
- **Configuration**: Update swap fees and exchange rates
- **Statistics**: Dashboard with order statistics and analytics

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Start server:**
```bash
npm start
```

3. **Health check:**
```bash
curl http://localhost:3000/health
```

## API Endpoints

### Deposit/Withdraw
```
POST   /api/v1/deposit-withdraw/deposit     # Create deposit order
POST   /api/v1/deposit-withdraw/withdraw    # Create withdraw order
GET    /api/v1/deposit-withdraw/orders/:type # Get orders by type
GET    /api/v1/deposit-withdraw/rates       # Get exchange rates
```

### Swap
```
GET    /api/v1/swap/config                  # Get swap configuration
GET    /api/v1/swap/fee-calculation         # Calculate platform fee
POST   /api/v1/swap/validate                # Validate swap parameters
```

### Admin
```
POST   /api/v1/admin/login                  # Admin login
GET    /api/v1/admin/dashboard              # Admin dashboard data
PUT    /api/v1/admin/orders/:id/status      # Update order status
PUT    /api/v1/admin/swap-config            # Update swap configuration
```

## Default Admin Credentials
- Username: `admin`
- Password: `admin123`
- **⚠️ Change in production!**

## Deploy on Render

1. Connect this GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add persistent disk at `/opt/render/project/data`
5. Configure environment variables

## Environment Variables

```bash
NODE_ENV=production
PORT=3000
STORAGE_DIR=/opt/render/project/data
JWT_SECRET=your-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=bcrypt-hash
```
