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

## API Endpoints

### Deposit/Withdraw
```
POST   /api/v1/deposit-withdraw/deposit     # Create deposit order
POST   /api/v1/deposit-withdraw/withdraw    # Create withdraw order
GET    /api/v1/deposit-withdraw/orders/:type # Get orders by type
GET    /api/v1/deposit-withdraw/order/:id   # Get specific order
GET    /api/v1/deposit-withdraw/rates       # Get exchange rates
GET    /api/v1/deposit-withdraw/stats       # Get statistics
```

### Swap
```
GET    /api/v1/swap/config                  # Get swap configuration
GET    /api/v1/swap/rates                   # Get swap rates (uses deposit/withdraw rates)
GET    /api/v1/swap/fee-calculation         # Calculate platform fee
POST   /api/v1/swap/validate                # Validate swap parameters
GET    /api/v1/swap/supported-tokens        # Get supported tokens
```

### Admin
```
POST   /api/v1/admin/login                  # Admin login
GET    /api/v1/admin/dashboard              # Admin dashboard data
GET    /api/v1/admin/orders                 # Get all orders with filtering
PUT    /api/v1/admin/orders/:id/status      # Update order status
PUT    /api/v1/admin/swap-config            # Update swap configuration
PUT    /api/v1/admin/exchange-rates         # Update exchange rates
GET    /api/v1/admin/stats                  # Detailed statistics
```

## Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start development server:**
```bash
npm run dev
```

4. **Start production server:**
```bash
npm start
```

## Deployment on Render

### 1. Create Render Web Service
- Connect your GitHub repository
- Set build command: `cd backend && npm install`
- Set start command: `cd backend && npm start`
- Set environment to Node.js

### 2. Configure Environment Variables
```bash
NODE_ENV=production
PORT=3000
STORAGE_DIR=/opt/render/project/data
JWT_SECRET=your-super-secret-jwt-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=your-bcrypt-hashed-password
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### 3. Add Render Disk Storage
- Go to your service settings
- Add a persistent disk
- Mount path: `/opt/render/project/data`
- Size: 1GB (or as needed)

### 4. Deploy
- Push to your main branch
- Render will automatically deploy

## Storage Structure

Data is stored in JSON files on disk:
```
/data/
├── deposit_orders.json      # Deposit order history
├── withdraw_orders.json     # Withdraw order history
├── swap_config.json         # Swap configuration
└── exchange_rates.json      # USD/VND exchange rates
```

## Default Configuration

### Swap Config
- Platform Fee: 0.7%
- Referrer Address: `0x62EC88A97156233cdB416024AC5011C5B9A6f361`
- Min Swap Amount: 1 USDT
- Max Swap Amount: 100,000 USDT
- Enabled Tokens: ['USDT', 'BNB', 'ETH', 'BTC']

### Exchange Rates
- USD to VND: 24,500 (configurable)

### Admin Credentials (Change in Production!)
- Username: `admin`
- Password: `admin123`

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **JWT Authentication**: Secure admin access
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses

## API Usage Examples

### Create Deposit Order
```javascript
const response = await fetch('/api/v1/deposit-withdraw/deposit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: '0x1234...5678',
    usdtAmount: 100,
    vndAmount: 2450000,
    transactionId: 'TXN123456789',
    bankInfo: { bankName: 'MB Bank', accountNumber: '0550100078888' }
  })
});
```

### Get Swap Fee Calculation
```javascript
const response = await fetch('/api/v1/swap/fee-calculation?amount=100');
const data = await response.json();
// Returns: { originalAmount: 100, platformFeeAmount: 0.7, netAmount: 99.3 }
```

### Admin Login
```javascript
const response = await fetch('/api/v1/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});
const { token } = await response.json();
```

## Health Check

Check if the service is running:
```bash
curl https://your-backend-url.com/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-09T12:00:00.000Z",
  "service": "Finan Wallet Backend",
  "version": "1.0.0"
}
```

## Support

For issues and questions, please check the logs and ensure all environment variables are properly configured.
