const express = require('express');
const { appendOrder, getOrders, updateOrderStatus, getExchangeRates } = require('../utils/storage');
const router = express.Router();

/**
 * POST /api/v1/deposit-withdraw/deposit
 * Create a new deposit order
 */
router.post('/deposit', async (req, res) => {
  try {
    const { walletAddress, usdtAmount, vndAmount, transactionId, bankInfo, userNote } = req.body;

    // Validation
    if (!walletAddress || !usdtAmount || !vndAmount || !transactionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['walletAddress', 'usdtAmount', 'vndAmount', 'transactionId']
      });
    }

    // Validate wallet address format (basic check)
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Validate amounts
    if (parseFloat(usdtAmount) <= 0 || parseFloat(vndAmount) <= 0) {
      return res.status(400).json({
        error: 'Amounts must be greater than 0'
      });
    }

    const orderData = {
      type: 'deposit',
      walletAddress,
      usdtAmount: parseFloat(usdtAmount),
      vndAmount: parseFloat(vndAmount),
      transactionId,
      bankInfo: bankInfo || null,
      userNote: userNote || '',
      clientIP: req.ip,
      userAgent: req.get('User-Agent')
    };

    const newOrder = await appendOrder('deposit', orderData);

    console.log(`📥 New deposit order created: ${newOrder.id} - ${usdtAmount} USDT for ${walletAddress}`);

    res.status(201).json({
      success: true,
      message: 'Deposit order created successfully',
      order: newOrder
    });

  } catch (error) {
    console.error('Error creating deposit order:', error);
    res.status(500).json({
      error: 'Failed to create deposit order',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/deposit-withdraw/withdraw
 * Create a new withdraw order
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { walletAddress, usdtAmount, vndAmount, bankAccount, userNote } = req.body;

    // Validation
    if (!walletAddress || !usdtAmount || !vndAmount || !bankAccount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['walletAddress', 'usdtAmount', 'vndAmount', 'bankAccount']
      });
    }

    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Validate amounts
    if (parseFloat(usdtAmount) <= 0 || parseFloat(vndAmount) <= 0) {
      return res.status(400).json({
        error: 'Amounts must be greater than 0'
      });
    }

    // Validate bank account info
    if (!bankAccount.accountNumber || !bankAccount.accountName || !bankAccount.bankName) {
      return res.status(400).json({
        error: 'Missing bank account information',
        required: ['accountNumber', 'accountName', 'bankName']
      });
    }

    const orderData = {
      type: 'withdraw',
      walletAddress,
      usdtAmount: parseFloat(usdtAmount),
      vndAmount: parseFloat(vndAmount),
      bankAccount,
      userNote: userNote || '',
      clientIP: req.ip,
      userAgent: req.get('User-Agent')
    };

    const newOrder = await appendOrder('withdraw', orderData);

    console.log(`📤 New withdraw order created: ${newOrder.id} - ${usdtAmount} USDT from ${walletAddress}`);

    res.status(201).json({
      success: true,
      message: 'Withdraw order created successfully',
      order: newOrder
    });

  } catch (error) {
    console.error('Error creating withdraw order:', error);
    res.status(500).json({
      error: 'Failed to create withdraw order',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/deposit-withdraw/orders/:type
 * Get orders by type (deposit or withdraw)
 */
router.get('/orders/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50, offset = 0, walletAddress } = req.query;

    if (!['deposit', 'withdraw'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid order type',
        validTypes: ['deposit', 'withdraw']
      });
    }

    let orders = await getOrders(type, parseInt(limit), parseInt(offset));

    // Filter by wallet address if provided
    if (walletAddress) {
      orders = orders.filter(order => 
        order.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
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
    console.error('Error getting orders:', error);
    res.status(500).json({
      error: 'Failed to get orders',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/deposit-withdraw/order/:orderId
 * Get specific order by ID
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Search in both deposit and withdraw orders
    const depositOrders = await getOrders('deposit', 1000);
    const withdrawOrders = await getOrders('withdraw', 1000);
    
    const allOrders = [...depositOrders, ...withdrawOrders];
    const order = allOrders.find(o => o.id === orderId);

    if (!order) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      error: 'Failed to get order',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/deposit-withdraw/rates
 * Get current exchange rates
 */
router.get('/rates', async (req, res) => {
  try {
    const rates = await getExchangeRates();
    
    res.json({
      success: true,
      rates: {
        usdToVnd: rates.USD_TO_VND,
        lastUpdated: rates.lastUpdated,
        source: rates.source
      }
    });

  } catch (error) {
    console.error('Error getting exchange rates:', error);
    res.status(500).json({
      error: 'Failed to get exchange rates',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/deposit-withdraw/stats
 * Get deposit/withdraw statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const depositOrders = await getOrders('deposit', 1000);
    const withdrawOrders = await getOrders('withdraw', 1000);

    const stats = {
      deposits: {
        total: depositOrders.length,
        pending: depositOrders.filter(o => o.status === 'pending').length,
        completed: depositOrders.filter(o => o.status === 'completed').length,
        failed: depositOrders.filter(o => o.status === 'failed').length,
        totalUSDT: depositOrders.reduce((sum, o) => sum + o.usdtAmount, 0),
        totalVND: depositOrders.reduce((sum, o) => sum + o.vndAmount, 0)
      },
      withdraws: {
        total: withdrawOrders.length,
        pending: withdrawOrders.filter(o => o.status === 'pending').length,
        completed: withdrawOrders.filter(o => o.status === 'completed').length,
        failed: withdrawOrders.filter(o => o.status === 'failed').length,
        totalUSDT: withdrawOrders.reduce((sum, o) => sum + o.usdtAmount, 0),
        totalVND: withdrawOrders.reduce((sum, o) => sum + o.vndAmount, 0)
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

module.exports = router;
