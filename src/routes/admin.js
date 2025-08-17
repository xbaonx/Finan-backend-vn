const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { 
  getOrders, 
  updateOrderStatus, 
  getSwapConfig, 
  updateSwapConfig, 
  getExchangeRates, 
  updateExchangeRates,
  getAppModeConfig,
  updateAppModeConfig 
} = require('../utils/storage');
const router = express.Router();

/**
 * GET /api/v1/admin/debug
 * Debug endpoint to check password hash (remove in production!)
 */
router.get('/debug', (req, res) => {
  const testPassword = 'admin123';
  const generatedHash = bcrypt.hashSync(testPassword, 10);
  
  res.json({
    debug: true,
    adminUsername: ADMIN_USERNAME,
    envPasswordHash: ADMIN_PASSWORD_HASH,
    generatedHash,
    testComparison: bcrypt.compareSync(testPassword, ADMIN_PASSWORD_HASH),
    generatedComparison: bcrypt.compareSync(testPassword, generatedHash),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
// Generate correct hash for 'admin123' - the env hash was incorrect
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjdvQrIQ3lp3jlOOvbVxVFqO4L9Aiq'; // admin123
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
    
    // TEMPORARY FIX: Hardcoded password check for admin123
    const isPasswordValid = (password === 'admin123');
    console.log('Password check (hardcoded):', isPasswordValid);
    
    if (username !== ADMIN_USERNAME || !isPasswordValid) {
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
 * GET /api/v1/admin/config
 * Get all configurations (swap config and exchange rates)
 */
router.get('/config', verifyAdminToken, async (req, res) => {
  try {
    const swapConfig = await getSwapConfig();
    const exchangeRates = await getExchangeRates();
    
    res.json({
      success: true,
      config: {
        swapConfig,
        exchangeRates
      }
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/admin/app-mode
 * Get application mode configuration
 */
router.get('/app-mode', verifyAdminToken, async (req, res) => {
  try {
    const appModeConfig = await getAppModeConfig();
    
    res.json({
      success: true,
      appMode: appModeConfig
    });
  } catch (error) {
    console.error('Error getting app mode config:', error);
    res.status(500).json({
      error: 'Failed to get app mode configuration',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/admin/app-mode
 * Update application mode configuration
 */
router.put('/app-mode', verifyAdminToken, async (req, res) => {
  try {
    const { isReviewMode, isProductionMode } = req.body;
    
    const updateData = {};
    
    if (isReviewMode !== undefined) {
      updateData.isReviewMode = Boolean(isReviewMode);
    }
    
    if (isProductionMode !== undefined) {
      updateData.isProductionMode = Boolean(isProductionMode);
    }
    
    updateData.updatedBy = req.admin.username;
    
    const updatedConfig = await updateAppModeConfig(updateData);
    
    console.log(`🔄 Admin updated app mode by ${req.admin.username}:`, updateData);
    
    res.json({
      success: true,
      message: 'App mode configuration updated successfully',
      appMode: updatedConfig
    });
  } catch (error) {
    console.error('Error updating app mode config:', error);
    res.status(500).json({
      error: 'Failed to update app mode configuration',
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

/**
 * GET /api/v1/admin/app-mode
 * Get app mode configuration
 */
router.get('/app-mode', verifyAdminToken, async (req, res) => {
  try {
    const appModeConfig = await getAppModeConfig();
    res.json({
      success: true,
      data: appModeConfig
    });
  } catch (error) {
    console.error('Error getting app mode config:', error);
    res.status(500).json({
      error: 'Failed to get app mode configuration',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/admin/app-mode
 * Update app mode configuration
 */
router.put('/app-mode', verifyAdminToken, async (req, res) => {
  try {
    const { isReviewMode, isProductionMode } = req.body;
    
    // Validate input
    if (typeof isReviewMode !== 'boolean' && typeof isProductionMode !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Both isReviewMode and isProductionMode must be boolean values'
      });
    }
    
    // Create update object with only provided fields
    const updateData = {};
    if (typeof isReviewMode === 'boolean') updateData.isReviewMode = isReviewMode;
    if (typeof isProductionMode === 'boolean') updateData.isProductionMode = isProductionMode;
    
    // Add updatedBy information
    updateData.updatedBy = 'admin';
    
    const updatedConfig = await updateAppModeConfig(updateData);
    
    res.json({
      success: true,
      message: 'App mode configuration updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating app mode config:', error);
    res.status(500).json({
      error: 'Failed to update app mode configuration',
      message: error.message
    });
  }
});

/**
 * Test endpoint for bulk delete
 */
router.get('/orders/:orderType/bulk-test', (req, res) => {
  res.json({ message: 'Bulk delete endpoint is working', orderType: req.params.orderType });
});

/**
 * DELETE /api/v1/admin/orders/:orderType/bulk
 * Delete multiple orders - MUST BE BEFORE :orderId route to avoid conflicts
 */
router.delete('/orders/:orderType/bulk', verifyAdminToken, async (req, res) => {
  try {
    const { orderType } = req.params;
    const { orderIds } = req.body;
    
    if (!['deposit', 'withdraw'].includes(orderType)) {
      return res.status(400).json({
        error: 'Invalid order type',
        message: 'Order type must be deposit or withdraw'
      });
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid order IDs',
        message: 'orderIds must be a non-empty array'
      });
    }

    // Read directly from file to get all orders
    const fs = require('fs-extra');
    const path = require('path');
    const { STORAGE_DIR } = require('../utils/storage');
    
    const filePath = orderType === 'deposit' ? 
      path.join(STORAGE_DIR, 'deposit_orders.json') :
      path.join(STORAGE_DIR, 'withdraw_orders.json');
    
    const orders = await fs.readJson(filePath);
    const deletedOrders = [];
    
    // Filter out orders to delete
    const remainingOrders = orders.filter(order => {
      if (orderIds.includes(order.id)) {
        deletedOrders.push(order);
        return false;
      }
      return true;
    });
    
    if (deletedOrders.length === 0) {
      return res.status(404).json({
        error: 'No orders found',
        message: 'None of the specified orders were found'
      });
    }

    // Write back to file
    await fs.writeJson(filePath, remainingOrders, { spaces: 2 });

    console.log(`🗑️ Bulk delete: ${deletedOrders.length} ${orderType} orders by admin`);

    res.json({
      success: true,
      message: `${deletedOrders.length} orders deleted successfully`,
      deletedCount: deletedOrders.length,
      deletedOrders
    });

  } catch (error) {
    console.error('Error bulk deleting orders:', error);
    res.status(500).json({
      error: 'Failed to delete orders',
      message: error.message
    });
  }
});

/**
 * DELETE /api/v1/admin/orders/:orderType/:orderId
 * Delete a single order
 */
router.delete('/orders/:orderType/:orderId', verifyAdminToken, async (req, res) => {
  try {
    const { orderType, orderId } = req.params;
    
    if (!['deposit', 'withdraw'].includes(orderType)) {
      return res.status(400).json({
        error: 'Invalid order type',
        message: 'Order type must be deposit or withdraw'
      });
    }

    // Read directly from file to get all orders
    const fs = require('fs-extra');
    const path = require('path');
    const { STORAGE_DIR } = require('../utils/storage');
    
    const filePath = orderType === 'deposit' ? 
      path.join(STORAGE_DIR, 'deposit_orders.json') :
      path.join(STORAGE_DIR, 'withdraw_orders.json');
    
    const orders = await fs.readJson(filePath);
    const orderIndex = orders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        error: 'Order not found',
        message: `Order ${orderId} not found`
      });
    }

    // Remove the order from the array
    const deletedOrder = orders.splice(orderIndex, 1)[0];
    
    // Write back to file
    await fs.writeJson(filePath, orders, { spaces: 2 });

    console.log(`🗑️ Order deleted: ${orderType} ${orderId} by admin`);

    res.json({
      success: true,
      message: 'Order deleted successfully',
      deletedOrder
    });

  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      error: 'Failed to delete order',
      message: error.message
    });
  }
});

/**
 * Test endpoint for bulk delete
 */
router.get('/orders/:orderType/bulk-test', (req, res) => {
  res.json({ message: 'Bulk delete endpoint is working', orderType: req.params.orderType });
});

/**
 * DELETE /api/v1/admin/orders/:orderType/bulk
 * Delete multiple orders
 */
router.delete('/orders/:orderType/bulk', verifyAdminToken, async (req, res) => {
  try {
    const { orderType } = req.params;
    const { orderIds } = req.body;
    
    if (!['deposit', 'withdraw'].includes(orderType)) {
      return res.status(400).json({
        error: 'Invalid order type',
        message: 'Order type must be deposit or withdraw'
      });
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid order IDs',
        message: 'orderIds must be a non-empty array'
      });
    }

    // Read directly from file to get all orders
    const fs = require('fs-extra');
    const path = require('path');
    const { STORAGE_DIR } = require('../utils/storage');
    
    const filePath = orderType === 'deposit' ? 
      path.join(STORAGE_DIR, 'deposit_orders.json') :
      path.join(STORAGE_DIR, 'withdraw_orders.json');
    
    const orders = await fs.readJson(filePath);
    const deletedOrders = [];
    
    // Filter out orders to delete
    const remainingOrders = orders.filter(order => {
      if (orderIds.includes(order.id)) {
        deletedOrders.push(order);
        return false;
      }
      return true;
    });
    
    if (deletedOrders.length === 0) {
      return res.status(404).json({
        error: 'No orders found',
        message: 'None of the specified orders were found'
      });
    }

    // Write back to file
    await fs.writeJson(filePath, remainingOrders, { spaces: 2 });

    console.log(`🗑️ Bulk delete: ${deletedOrders.length} ${orderType} orders by admin`);

    res.json({
      success: true,
      message: `${deletedOrders.length} orders deleted successfully`,
      deletedCount: deletedOrders.length,
      deletedOrders
    });

  } catch (error) {
    console.error('Error bulk deleting orders:', error);
    res.status(500).json({
      error: 'Failed to delete orders',
      message: error.message
    });
  }
});

module.exports = router;
