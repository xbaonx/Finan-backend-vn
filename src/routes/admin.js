const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { 
  getOrders, 
  updateOrderStatus, 
  getSwapConfig, 
  updateSwapConfig, 
  getExchangeRates, 
  updateExchangeRates 
} = require('../utils/storage');
const router = express.Router();

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'finan-wallet-secret-key-change-in-production';

/**
 * Middleware to verify admin JWT token
 */
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: 'Access denied',
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Access denied',
      message: 'Invalid token'
    });
  }
};

/**
 * POST /api/v1/admin/login
 * Admin login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        required: ['username', 'password']
      });
    }

    // Check username and password
    console.log('Login attempt:', { username, password: '***', expectedUsername: ADMIN_USERNAME });
    console.log('Password hash check:', bcrypt.compareSync(password, ADMIN_PASSWORD_HASH));
    
    if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
      console.log('Login failed - invalid credentials');
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`🔐 Admin login successful: ${username} from ${req.ip}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/admin/dashboard
 * Get admin dashboard data
 */
router.get('/dashboard', verifyAdminToken, async (req, res) => {
  try {
    const depositOrders = await getOrders('deposit', 100);
    const withdrawOrders = await getOrders('withdraw', 100);
    const swapConfig = await getSwapConfig();
    const exchangeRates = await getExchangeRates();

    const dashboardData = {
      summary: {
        totalDeposits: depositOrders.length,
        totalWithdraws: withdrawOrders.length,
        pendingDeposits: depositOrders.filter(o => o.status === 'pending').length,
        pendingWithdraws: withdrawOrders.filter(o => o.status === 'pending').length,
        totalUSDTDeposited: depositOrders.reduce((sum, o) => sum + o.usdtAmount, 0),
        totalUSDTWithdrawn: withdrawOrders.reduce((sum, o) => sum + o.usdtAmount, 0)
      },
      recentOrders: {
        deposits: depositOrders.slice(0, 10),
        withdraws: withdrawOrders.slice(0, 10)
      },
      config: {
        swapConfig,
        exchangeRates
      }
    };

    res.json({
      success: true,
      dashboard: dashboardData
    });

  } catch (error) {
    console.error('Error getting admin dashboard:', error);
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/admin/orders
 * Get all orders with pagination and filtering
 */
router.get('/orders', verifyAdminToken, async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;

    let orders = [];

    if (type === 'deposit') {
      orders = await getOrders('deposit', parseInt(limit), parseInt(offset));
    } else if (type === 'withdraw') {
      orders = await getOrders('withdraw', parseInt(limit), parseInt(offset));
    } else {
      // Get both types
      const deposits = await getOrders('deposit', 1000);
      const withdraws = await getOrders('withdraw', 1000);
      orders = [...deposits, ...withdraws]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    }

    // Filter by status if provided
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    res.json({
      success: true,
      orders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: orders.length
      }
    });

  } catch (error) {
    console.error('Error getting admin orders:', error);
    res.status(500).json({
      error: 'Failed to get orders',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/admin/orders/:orderId/status
 * Update order status
 */
router.put('/orders/:orderId/status', verifyAdminToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Missing status',
        validStatuses: ['pending', 'completed', 'failed', 'cancelled']
      });
    }

    if (!['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses: ['pending', 'completed', 'failed', 'cancelled']
      });
    }

    // Try to update in both deposit and withdraw orders
    let updatedOrder = null;
    try {
      updatedOrder = await updateOrderStatus('deposit', orderId, status, notes);
    } catch (error) {
      try {
        updatedOrder = await updateOrderStatus('withdraw', orderId, status, notes);
      } catch (error2) {
        return res.status(404).json({
          error: 'Order not found'
        });
      }
    }

    console.log(`📝 Admin updated order ${orderId} status to ${status} by ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      error: 'Failed to update order status',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/admin/swap-config
 * Update swap configuration
 */
router.put('/swap-config', verifyAdminToken, async (req, res) => {
  try {
    const { platformFeePercentage, minSwapAmount, maxSwapAmount, enabledTokens } = req.body;

    const updateData = {};
    
    if (platformFeePercentage !== undefined) {
      if (platformFeePercentage < 0 || platformFeePercentage > 5) {
        return res.status(400).json({
          error: 'Invalid platform fee percentage',
          message: 'Fee must be between 0% and 5%'
        });
      }
      updateData.platformFeePercentage = parseFloat(platformFeePercentage);
    }

    if (minSwapAmount !== undefined) {
      updateData.minSwapAmount = parseFloat(minSwapAmount);
    }

    if (maxSwapAmount !== undefined) {
      updateData.maxSwapAmount = parseFloat(maxSwapAmount);
    }

    if (enabledTokens !== undefined) {
      if (!Array.isArray(enabledTokens)) {
        return res.status(400).json({
          error: 'enabledTokens must be an array'
        });
      }
      updateData.enabledTokens = enabledTokens;
    }

    const updatedConfig = await updateSwapConfig(updateData);

    console.log(`⚙️ Admin updated swap config by ${req.admin.username}:`, updateData);

    res.json({
      success: true,
      message: 'Swap configuration updated successfully',
      config: updatedConfig
    });

  } catch (error) {
    console.error('Error updating swap config:', error);
    res.status(500).json({
      error: 'Failed to update swap configuration',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/admin/exchange-rates
 * Update exchange rates
 */
router.put('/exchange-rates', verifyAdminToken, async (req, res) => {
  try {
    const { USD_TO_VND, source } = req.body;

    if (!USD_TO_VND || parseFloat(USD_TO_VND) <= 0) {
      return res.status(400).json({
        error: 'Invalid exchange rate',
        message: 'USD_TO_VND must be a positive number'
      });
    }

    const updateData = {
      USD_TO_VND: parseFloat(USD_TO_VND),
      source: source || 'admin'
    };

    const updatedRates = await updateExchangeRates(updateData);

    console.log(`💱 Admin updated exchange rates by ${req.admin.username}:`, updateData);

    res.json({
      success: true,
      message: 'Exchange rates updated successfully',
      rates: updatedRates
    });

  } catch (error) {
    console.error('Error updating exchange rates:', error);
    res.status(500).json({
      error: 'Failed to update exchange rates',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/admin/stats
 * Get detailed statistics
 */
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    const depositOrders = await getOrders('deposit', 1000);
    const withdrawOrders = await getOrders('withdraw', 1000);

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Filter orders by date range
    const recentDeposits = depositOrders.filter(o => new Date(o.createdAt) >= startDate);
    const recentWithdraws = withdrawOrders.filter(o => new Date(o.createdAt) >= startDate);

    const stats = {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      deposits: {
        total: recentDeposits.length,
        completed: recentDeposits.filter(o => o.status === 'completed').length,
        pending: recentDeposits.filter(o => o.status === 'pending').length,
        failed: recentDeposits.filter(o => o.status === 'failed').length,
        totalUSDT: recentDeposits.reduce((sum, o) => sum + o.usdtAmount, 0),
        totalVND: recentDeposits.reduce((sum, o) => sum + o.vndAmount, 0)
      },
      withdraws: {
        total: recentWithdraws.length,
        completed: recentWithdraws.filter(o => o.status === 'completed').length,
        pending: recentWithdraws.filter(o => o.status === 'pending').length,
        failed: recentWithdraws.filter(o => o.status === 'failed').length,
        totalUSDT: recentWithdraws.reduce((sum, o) => sum + o.usdtAmount, 0),
        totalVND: recentWithdraws.reduce((sum, o) => sum + o.vndAmount, 0)
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

module.exports = router;
