const fs = require('fs-extra');
const path = require('path');

// Storage paths - using Render's persistent disk
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '../../data');
const DEPOSIT_ORDERS_FILE = path.join(STORAGE_DIR, 'deposit_orders.json');
const WITHDRAW_ORDERS_FILE = path.join(STORAGE_DIR, 'withdraw_orders.json');
const SWAP_CONFIG_FILE = path.join(STORAGE_DIR, 'swap_config.json');
const EXCHANGE_RATES_FILE = path.join(STORAGE_DIR, 'exchange_rates.json');
const APP_MODE_CONFIG_FILE = path.join(STORAGE_DIR, 'app_mode_config.json');
const ANALYTICS_DATA_FILE = path.join(STORAGE_DIR, 'analytics_data.json');

// Default configurations
const DEFAULT_SWAP_CONFIG = {
  platformFeePercentage: 0.7, // 0.7% platform fee
  referrerAddress: '0x62EC88A97156233cdB416024AC5011C5B9A6f361',
  minSwapAmount: 1, // Minimum 1 USDT
  maxSwapAmount: 100000, // Maximum 100,000 USDT
  enabledTokens: ['USDT', 'BNB', 'ETH', 'BTC'],
  lastUpdated: new Date().toISOString()
};

const DEFAULT_EXCHANGE_RATES = {
  USD_TO_VND: 24500, // 1 USD = 24,500 VND
  lastUpdated: new Date().toISOString(),
  source: 'manual' // manual, api, etc.
};

const DEFAULT_APP_MODE_CONFIG = {
  isReviewMode: true, // Mặc định là chế độ review
  isProductionMode: false, // Mặc định không phải chế độ production
  lastUpdated: new Date().toISOString(),
  updatedBy: 'system'
};

const DEFAULT_ANALYTICS_DATA = {
  installs: [],
  events: [],
  utmStats: {},
  dashboard: {
    totalUsers: 0,
    activeUsers30d: 0,
    retentionRate: 0.65,
    avgRevenuePerUser: 0
  },
  lastUpdated: new Date().toISOString()
};

/**
 * Initialize storage directory and files
 */
async function initializeStorage() {
  try {
    // Create storage directory if it doesn't exist
    await fs.ensureDir(STORAGE_DIR);
    console.log(`📁 Storage directory ensured: ${STORAGE_DIR}`);

    // Initialize deposit orders file
    if (!await fs.pathExists(DEPOSIT_ORDERS_FILE)) {
      await fs.writeJson(DEPOSIT_ORDERS_FILE, []);
      console.log('📝 Initialized deposit orders file');
    }

    // Initialize withdraw orders file
    if (!await fs.pathExists(WITHDRAW_ORDERS_FILE)) {
      await fs.writeJson(WITHDRAW_ORDERS_FILE, []);
      console.log('📝 Initialized withdraw orders file');
    }

    // Initialize swap config file
    if (!await fs.pathExists(SWAP_CONFIG_FILE)) {
      await fs.writeJson(SWAP_CONFIG_FILE, DEFAULT_SWAP_CONFIG);
      console.log('⚙️ Initialized swap config file');
    }

    // Initialize exchange rates file
    if (!await fs.pathExists(EXCHANGE_RATES_FILE)) {
      await fs.writeJson(EXCHANGE_RATES_FILE, DEFAULT_EXCHANGE_RATES);
      console.log('💱 Initialized exchange rates file');
    }
    
    // Initialize app mode config file
    if (!await fs.pathExists(APP_MODE_CONFIG_FILE)) {
      await fs.writeJson(APP_MODE_CONFIG_FILE, DEFAULT_APP_MODE_CONFIG);
      console.log('🔄 Initialized app mode config file');
    }
    
    // Initialize analytics data file
    if (!await fs.pathExists(ANALYTICS_DATA_FILE)) {
      await fs.writeJson(ANALYTICS_DATA_FILE, DEFAULT_ANALYTICS_DATA);
      console.log('📈 Initialized analytics data file');
    }

    console.log('✅ All storage files initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize storage:', error);
    throw error;
  }
}

/**
 * Read data from JSON file
 */
async function readJsonFile(filePath) {
  try {
    return await fs.readJson(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Write data to JSON file
 */
async function writeJsonFile(filePath, data) {
  try {
    await fs.writeJson(filePath, data, { spaces: 2 });
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Append order to orders file
 */
async function appendOrder(orderType, orderData) {
  const filePath = orderType === 'deposit' ? DEPOSIT_ORDERS_FILE : WITHDRAW_ORDERS_FILE;
  
  try {
    const orders = await readJsonFile(filePath);
    orders.push({
      ...orderData,
      id: require('uuid').v4(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    
    await writeJsonFile(filePath, orders);
    return orders[orders.length - 1];
  } catch (error) {
    console.error(`Error appending ${orderType} order:`, error);
    throw error;
  }
}

/**
 * Get all orders by type
 */
async function getOrders(orderType, limit = 100, offset = 0) {
  const filePath = orderType === 'deposit' ? DEPOSIT_ORDERS_FILE : WITHDRAW_ORDERS_FILE;
  
  try {
    const orders = await readJsonFile(filePath);
    return orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(offset, offset + limit);
  } catch (error) {
    console.error(`Error getting ${orderType} orders:`, error);
    throw error;
  }
}

/**
 * Update order status
 */
async function updateOrderStatus(orderType, orderId, status, notes = '') {
  const filePath = orderType === 'deposit' ? DEPOSIT_ORDERS_FILE : WITHDRAW_ORDERS_FILE;
  
  try {
    const orders = await readJsonFile(filePath);
    const orderIndex = orders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    orders[orderIndex] = {
      ...orders[orderIndex],
      status,
      notes,
      updatedAt: new Date().toISOString()
    };
    
    await writeJsonFile(filePath, orders);
    return orders[orderIndex];
  } catch (error) {
    console.error(`Error updating ${orderType} order status:`, error);
    throw error;
  }
}

/**
 * Get swap configuration
 */
async function getSwapConfig() {
  try {
    return await readJsonFile(SWAP_CONFIG_FILE);
  } catch (error) {
    console.error('Error getting swap config:', error);
    return DEFAULT_SWAP_CONFIG;
  }
}

/**
 * Update swap configuration
 */
async function updateSwapConfig(newConfig) {
  try {
    const currentConfig = await getSwapConfig();
    const updatedConfig = {
      ...currentConfig,
      ...newConfig,
      lastUpdated: new Date().toISOString()
    };
    
    await writeJsonFile(SWAP_CONFIG_FILE, updatedConfig);
    return updatedConfig;
  } catch (error) {
    console.error('Error updating swap config:', error);
    throw error;
  }
}

/**
 * Get exchange rates
 */
async function getExchangeRates() {
  try {
    return await readJsonFile(EXCHANGE_RATES_FILE);
  } catch (error) {
    console.error('Error getting exchange rates:', error);
    return DEFAULT_EXCHANGE_RATES;
  }
}

/**
 * Update exchange rates
 */
async function updateExchangeRates(newRates) {
  try {
    const currentRates = await getExchangeRates();
    
    const updatedRates = {
      ...currentRates,
      ...newRates,
      lastUpdated: new Date().toISOString()
    };
    
    await writeJsonFile(EXCHANGE_RATES_FILE, updatedRates);
    return updatedRates;
  } catch (error) {
    console.error('Error updating exchange rates:', error);
    throw error;
  }
}

/**
 * Get app mode configuration
 */
async function getAppModeConfig() {
  try {
    return await readJsonFile(APP_MODE_CONFIG_FILE);
  } catch (error) {
    console.error('Error getting app mode config:', error);
    throw error;
  }
}

/**
 * Update app mode configuration
 */
async function updateAppModeConfig(newConfig) {
  try {
    const currentConfig = await getAppModeConfig();
    
    const updatedConfig = {
      ...currentConfig,
      ...newConfig,
      lastUpdated: new Date().toISOString()
    };
    
    await writeJsonFile(APP_MODE_CONFIG_FILE, updatedConfig);
    return updatedConfig;
  } catch (error) {
    console.error('Error updating app mode config:', error);
    throw error;
  }
}

/**
 * Get analytics data
 */
async function getAnalyticsData() {
  try {
    return await readJsonFile(ANALYTICS_DATA_FILE);
  } catch (error) {
    console.error('Error getting analytics data:', error);
    throw error;
  }
}

/**
 * Update analytics data
 */
async function updateAnalyticsData(data) {
  try {
    const currentData = await getAnalyticsData();
    const updatedData = {
      ...currentData,
      ...data,
      lastUpdated: new Date().toISOString()
    };
    await writeJsonFile(ANALYTICS_DATA_FILE, updatedData);
    return updatedData;
  } catch (error) {
    console.error('Error updating analytics data:', error);
    throw error;
  }
}

/**
 * Add install data
 */
async function addInstallData(installData) {
  try {
    const analyticsData = await getAnalyticsData();
    const newInstall = {
      ...installData,
      id: require('uuid').v4(),
      install_date: new Date().toISOString()
    };
    
    analyticsData.installs.push(newInstall);
    await writeJsonFile(ANALYTICS_DATA_FILE, analyticsData);
    return newInstall;
  } catch (error) {
    console.error('Error adding install data:', error);
    throw error;
  }
}

/**
 * Add event data
 */
async function addEventData(eventData) {
  try {
    const analyticsData = await getAnalyticsData();
    const newEvent = {
      ...eventData,
      id: require('uuid').v4(),
      timestamp: new Date().toISOString()
    };
    
    analyticsData.events.push(newEvent);
    await writeJsonFile(ANALYTICS_DATA_FILE, analyticsData);
    return newEvent;
  } catch (error) {
    console.error('Error adding event data:', error);
    throw error;
  }
}

/**
 * Clear analytics data (for testing)
 */
async function clearAnalyticsData() {
  try {
    await writeJsonFile(ANALYTICS_DATA_FILE, DEFAULT_ANALYTICS_DATA);
    return { success: true, message: 'Analytics data cleared successfully' };
  } catch (error) {
    console.error('Error clearing analytics data:', error);
    throw error;
  }
}

module.exports = {
  initializeStorage,
  getOrders,
  appendOrder,
  updateOrderStatus,
  getSwapConfig,
  updateSwapConfig,
  getExchangeRates,
  updateExchangeRates,
  getAppModeConfig,
  updateAppModeConfig,
  getAnalyticsData,
  updateAnalyticsData,
  addInstallData,
  addEventData,
  clearAnalyticsData,
  getStorage: () => ({
    getOrders,
    appendOrder,
    updateOrderStatus,
    getSwapConfig,
    updateSwapConfig,
    getExchangeRates,
    updateExchangeRates,
    getAppModeConfig,
    updateAppModeConfig,
    getAnalyticsData,
    updateAnalyticsData,
    addInstallData,
    addEventData,
    clearAnalyticsData
  }),
  STORAGE_DIR
};
