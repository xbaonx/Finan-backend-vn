const express = require('express');
const { getSwapConfig, updateSwapConfig, getExchangeRates } = require('../utils/storage');
const router = express.Router();

/**
 * GET /api/v1/swap/config
 * Get current swap configuration (platform fee, etc.)
 */
router.get('/config', async (req, res) => {
  try {
    const config = await getSwapConfig();
    
    res.json({
      success: true,
      config: {
        platformFeePercentage: config.platformFeePercentage,
        referrerAddress: config.referrerAddress,
        minSwapAmount: config.minSwapAmount,
        maxSwapAmount: config.maxSwapAmount,
        enabledTokens: config.enabledTokens,
        lastUpdated: config.lastUpdated
      }
    });

  } catch (error) {
    console.error('Error getting swap config:', error);
    res.status(500).json({
      error: 'Failed to get swap configuration',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/swap/rates
 * Get exchange rates for swap (uses deposit/withdraw rates)
 */
router.get('/rates', async (req, res) => {
  try {
    const rates = await getExchangeRates();
    const swapConfig = await getSwapConfig();
    
    res.json({
      success: true,
      rates: {
        usdToVnd: rates.USD_TO_VND,
        platformFeePercentage: swapConfig.platformFeePercentage,
        lastUpdated: rates.lastUpdated,
        source: rates.source
      },
      message: 'Swap rates use the same exchange rate as deposit/withdraw'
    });

  } catch (error) {
    console.error('Error getting swap rates:', error);
    res.status(500).json({
      error: 'Failed to get swap rates',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/swap/fee-calculation
 * Calculate platform fee for a given swap amount
 */
router.get('/fee-calculation', async (req, res) => {
  try {
    const { amount } = req.query;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a positive number'
      });
    }

    const config = await getSwapConfig();
    const swapAmount = parseFloat(amount);
    const platformFee = (swapAmount * config.platformFeePercentage) / 100;
    const netAmount = swapAmount - platformFee;

    res.json({
      success: true,
      calculation: {
        originalAmount: swapAmount,
        platformFeePercentage: config.platformFeePercentage,
        platformFeeAmount: platformFee,
        netAmount: netAmount,
        referrerAddress: config.referrerAddress
      }
    });

  } catch (error) {
    console.error('Error calculating swap fee:', error);
    res.status(500).json({
      error: 'Failed to calculate swap fee',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/swap/validate
 * Validate swap parameters before execution
 */
router.post('/validate', async (req, res) => {
  try {
    const { fromToken, toToken, amount, walletAddress } = req.body;

    // Validation
    if (!fromToken || !toToken || !amount || !walletAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fromToken', 'toToken', 'amount', 'walletAddress']
      });
    }

    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    const config = await getSwapConfig();
    const swapAmount = parseFloat(amount);

    // Check amount limits
    if (swapAmount < config.minSwapAmount) {
      return res.status(400).json({
        error: 'Amount too small',
        message: `Minimum swap amount is ${config.minSwapAmount} USDT`
      });
    }

    if (swapAmount > config.maxSwapAmount) {
      return res.status(400).json({
        error: 'Amount too large',
        message: `Maximum swap amount is ${config.maxSwapAmount} USDT`
      });
    }

    // Check if tokens are enabled
    if (!config.enabledTokens.includes(fromToken) || !config.enabledTokens.includes(toToken)) {
      return res.status(400).json({
        error: 'Token not supported',
        message: 'One or both tokens are not currently supported',
        enabledTokens: config.enabledTokens
      });
    }

    // Calculate fees
    const platformFee = (swapAmount * config.platformFeePercentage) / 100;
    const netAmount = swapAmount - platformFee;

    res.json({
      success: true,
      validation: {
        valid: true,
        fromToken,
        toToken,
        amount: swapAmount,
        platformFee,
        netAmount,
        walletAddress
      },
      config: {
        platformFeePercentage: config.platformFeePercentage,
        referrerAddress: config.referrerAddress
      }
    });

  } catch (error) {
    console.error('Error validating swap:', error);
    res.status(500).json({
      error: 'Failed to validate swap',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/swap/supported-tokens
 * Get list of supported tokens for swap
 */
router.get('/supported-tokens', async (req, res) => {
  try {
    const config = await getSwapConfig();
    
    res.json({
      success: true,
      tokens: config.enabledTokens,
      lastUpdated: config.lastUpdated
    });

  } catch (error) {
    console.error('Error getting supported tokens:', error);
    res.status(500).json({
      error: 'Failed to get supported tokens',
      message: error.message
    });
  }
});

module.exports = router;
