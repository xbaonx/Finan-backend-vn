const express = require('express');
const router = express.Router();
const { getStorage } = require('../utils/storage');

// Helper function to generate UUID (sử dụng cho backward compatibility)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to calculate UTM stats with custom date range
async function calculateUTMStatsCustomRange(startDateStr, endDateStr) {
  const storage = getStorage();
  const analyticsData = await storage.getAnalyticsData();
  
  // Parse dates from strings (YYYY-MM-DD format)
  const startDate = new Date(startDateStr);
  // Set endDate to end of the day (23:59:59)
  const endDate = new Date(endDateStr);
  endDate.setHours(23, 59, 59, 999);
  
  // Filter installs within date range
  const recentInstalls = analyticsData.installs.filter(install => {
    const installDate = new Date(install.install_date);
    return installDate >= startDate && installDate <= endDate;
  });

  // Filter events within date range
  const recentEvents = analyticsData.events.filter(event => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= startDate && eventDate <= endDate;
  });
  
  // Group by source (same logic as calculateUTMStats)
  const sources = {};
  recentInstalls.forEach(install => {
    const source = install.utm_source || 'organic';
    if (!sources[source]) {
      sources[source] = { installs: 0, conversions: 0, revenue: 0 };
    }
    sources[source].installs++;
  });

  // Calculate conversions and revenue from events
  recentEvents.forEach(event => {
    const source = event.utm_source || 'organic';
    if (sources[source]) {
      if (event.event_name === 'first_deposit' || event.event_name === 'high_value_action') {
        sources[source].conversions++;
        sources[source].revenue += event.event_params?.value || event.event_params?.deposit_amount || 0;
      }
    }
  });

  // Group by campaign
  const campaigns = {};
  recentInstalls.forEach(install => {
    const campaign = install.utm_campaign;
    if (campaign) {
      if (!campaigns[campaign]) {
        campaigns[campaign] = { installs: 0, cost: 0, roi: 0 };
      }
      campaigns[campaign].installs++;
      campaigns[campaign].cost = campaigns[campaign].installs * 2.5; // Assumed cost per install
    }
  });

  // Calculate ROI for campaigns
  Object.keys(campaigns).forEach(campaign => {
    const campaignRevenue = recentEvents
      .filter(event => event.utm_campaign === campaign)
      .reduce((sum, event) => sum + (event.event_params?.value || event.event_params?.deposit_amount || 0), 0);
    
    campaigns[campaign].roi = campaigns[campaign].cost > 0 ? 
      (campaignRevenue / campaigns[campaign].cost) : 0;
  });

  return {
    total_installs: recentInstalls.length,
    sources,
    campaigns,
    time_range: `custom (${startDateStr} to ${endDateStr})`
  };
}

// Helper function to calculate UTM stats
async function calculateUTMStats(timeRange = '30d') {
  const storage = getStorage();
  const analyticsData = await storage.getAnalyticsData();
  
  const now = new Date();
  let cutoffDate;
  
  if (timeRange === 'today') {
    // Đặt cutoffDate là đầu ngày hôm nay (00:00:00)
    cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else {
    // Xử lý các khoảng thời gian khác như cũ
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  }

  const recentInstalls = analyticsData.installs.filter(install => 
    new Date(install.install_date) >= cutoffDate
  );

  const recentEvents = analyticsData.events.filter(event => 
    new Date(event.timestamp) >= cutoffDate
  );

  // Group by source
  const sources = {};
  recentInstalls.forEach(install => {
    const source = install.utm_source || 'organic';
    if (!sources[source]) {
      sources[source] = { installs: 0, conversions: 0, revenue: 0 };
    }
    sources[source].installs++;
  });

  // Calculate conversions and revenue from events
  recentEvents.forEach(event => {
    const source = event.utm_source || 'organic';
    if (sources[source]) {
      if (event.event_name === 'first_deposit' || event.event_name === 'high_value_action') {
        sources[source].conversions++;
        sources[source].revenue += event.event_params?.value || event.event_params?.deposit_amount || 0;
      }
    }
  });

  // Group by campaign
  const campaigns = {};
  recentInstalls.forEach(install => {
    const campaign = install.utm_campaign;
    if (campaign) {
      if (!campaigns[campaign]) {
        campaigns[campaign] = { installs: 0, cost: 0, roi: 0 };
      }
      campaigns[campaign].installs++;
      campaigns[campaign].cost = campaigns[campaign].installs * 2.5; // Assumed cost per install
    }
  });

  // Calculate ROI for campaigns
  Object.keys(campaigns).forEach(campaign => {
    const campaignRevenue = recentEvents
      .filter(event => event.utm_campaign === campaign)
      .reduce((sum, event) => sum + (event.event_params?.value || event.event_params?.deposit_amount || 0), 0);
    
    campaigns[campaign].roi = campaigns[campaign].cost > 0 ? 
      (campaignRevenue / campaigns[campaign].cost) : 0;
  });

  return {
    total_installs: recentInstalls.length,
    sources,
    campaigns,
    time_range: timeRange
  };
}

// POST /analytics/install - Track app installations
router.post('/install', async (req, res) => {
  try {
    const storage = getStorage();
    const analyticsData = await storage.getAnalyticsData();
    
    const installData = {
      ...req.body,
      install_id: generateUUID(),
      tracked_at: new Date().toISOString()
    };

    // Thêm install mới vào storage
    await storage.addInstallData(installData);
    
    // Cập nhật dashboard metrics
    analyticsData.dashboard.totalUsers++;
    await storage.updateAnalyticsData({ dashboard: analyticsData.dashboard });

    console.log('📊 Install tracked:', installData);

    res.json({
      success: true,
      install_id: installData.install_id,
      message: 'Install tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking install:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track install',
      error: error.message
    });
  }
});

// POST /analytics/event - Track custom events
router.post('/event', async (req, res) => {
  try {
    const storage = getStorage();
    const analyticsData = await storage.getAnalyticsData();
    
    const eventData = {
      ...req.body,
      event_id: generateUUID(),
      tracked_at: new Date().toISOString()
    };

    // Thêm event mới vào storage
    await storage.addEventData(eventData);

    // Update dashboard metrics based on event
    if (eventData.event_name === 'first_deposit') {
      const depositAmount = eventData.event_params?.deposit_amount || 0;
      analyticsData.dashboard.avgRevenuePerUser = 
        (analyticsData.dashboard.avgRevenuePerUser * analyticsData.dashboard.totalUsers + depositAmount) / 
        Math.max(analyticsData.dashboard.totalUsers, 1);
      
      // Cập nhật dashboard metrics trong storage
      await storage.updateAnalyticsData({ dashboard: analyticsData.dashboard });
    }

    console.log('📊 Event tracked:', eventData);

    res.json({
      success: true,
      event_id: eventData.event_id,
      message: 'Event tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track event',
      error: error.message
    });
  }
});

// GET /analytics/utm-stats - Get UTM campaign statistics
router.get('/utm-stats', async (req, res) => {
  try {
    let stats;
    
    // Kiểm tra nếu có tham số startDate và endDate
    if (req.query.startDate && req.query.endDate) {
      // Sử dụng khoảng thời gian tùy chỉnh
      stats = await calculateUTMStatsCustomRange(req.query.startDate, req.query.endDate);
    } else {
      // Sử dụng khoảng thời gian cố định
      const timeRange = req.query.range || '30d';
      stats = await calculateUTMStats(timeRange);
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting UTM stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get UTM stats',
      error: error.message
    });
  }
});

// GET /analytics/dashboard - Get analytics dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const storage = getStorage();
    const analyticsData = await storage.getAnalyticsData();
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Calculate active users (users with events in last 30 days)
    const activeUserEvents = analyticsData.events.filter(event => 
      new Date(event.timestamp) >= thirtyDaysAgo
    );
    const activeUsers = new Set(activeUserEvents.map(event => event.user_id || 'anonymous')).size;

    // Get top sources
    const utmStats = await calculateUTMStats('30d');
    const topSources = Object.entries(utmStats.sources)
      .sort(([,a], [,b]) => b.installs - a.installs)
      .slice(0, 5)
      .map(([source, data]) => ({ source, ...data }));

    // Get recent events (last 10)
    const recentEvents = analyticsData.events
      .sort((a, b) => new Date(b.tracked_at) - new Date(a.tracked_at))
      .slice(0, 10)
      .map(event => ({
        event_name: event.event_name,
        timestamp: event.tracked_at,
        utm_source: event.utm_source || 'organic',
        value: event.event_params?.deposit_amount || event.event_params?.value || 0
      }));

    // Conversion funnel
    const totalInstalls = analyticsData.installs.length;
    const walletCreated = analyticsData.events.filter(e => e.event_name === 'wallet_created').length;
    const firstDeposits = analyticsData.events.filter(e => e.event_name === 'first_deposit').length;
    const tokenSwaps = analyticsData.events.filter(e => e.event_name === 'token_swap').length;

    const conversionFunnel = {
      installs: totalInstalls,
      wallet_created: walletCreated,
      first_deposit: firstDeposits,
      token_swap: tokenSwaps,
      conversion_rates: {
        install_to_wallet: totalInstalls > 0 ? (walletCreated / totalInstalls * 100).toFixed(1) : 0,
        wallet_to_deposit: walletCreated > 0 ? (firstDeposits / walletCreated * 100).toFixed(1) : 0,
        deposit_to_swap: firstDeposits > 0 ? (tokenSwaps / firstDeposits * 100).toFixed(1) : 0
      }
    };

    const dashboardData = {
      overview: {
        total_users: analyticsData.dashboard.totalUsers,
        active_users_30d: Math.max(activeUsers, Math.floor(analyticsData.dashboard.totalUsers * 0.6)),
        retention_rate: analyticsData.dashboard.retentionRate,
        avg_revenue_per_user: analyticsData.dashboard.avgRevenuePerUser.toFixed(2)
      },
      top_sources: topSources,
      recent_events: recentEvents,
      conversion_funnel: conversionFunnel,
      utm_stats: utmStats
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
});

// GET /analytics/data - Get raw analytics data (for debugging)
router.get('/data', async (req, res) => {
  try {
    const storage = getStorage();
    const analyticsData = await storage.getAnalyticsData();
    
    res.json({
      installs: analyticsData.installs.length,
      events: analyticsData.events.length,
      recent_installs: analyticsData.installs.slice(-5),
      recent_events: analyticsData.events.slice(-5)
    });
  } catch (error) {
    console.error('Error getting analytics data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics data',
      error: error.message
    });
  }
});

// POST /analytics/sample-data - Generate sample data for testing
router.post('/sample-data', async (req, res) => {
  try {
    const storage = getStorage();
    let analyticsData = await storage.getAnalyticsData();
    
    // Xóa dữ liệu hiện tại trước khi tạo dữ liệu mới
    await storage.clearAnalyticsData();
    analyticsData = await storage.getAnalyticsData(); // Lấy lại dữ liệu trống
    
    // Generate sample installs
    const sources = ['facebook', 'telegram', 'tiktok', 'organic'];
    const campaigns = ['crypto_launch', 'defi_promo', 'community_growth'];
    const installPromises = [];
    
    for (let i = 0; i < 50; i++) {
      const source = sources[Math.floor(Math.random() * sources.length)];
      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const installDate = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
      
      const installData = {
        utm_source: source,
        utm_medium: source === 'organic' ? 'organic' : 'cpc',
        utm_campaign: source === 'organic' ? 'organic' : campaign,
        utm_content: source === 'facebook' ? 'video_ad' : 'social_post',
        platform: Math.random() > 0.5 ? 'android' : 'ios',
        install_date: installDate.toISOString(),
        device_info: {
          platform: Math.random() > 0.5 ? 'android' : 'ios',
          app_version: '1.0.0',
          device_model: 'Sample Device',
          os_version: '12.0'
        },
        tracked_at: installDate.toISOString(),
        event_type: 'app_install'
      };
      
      installPromises.push(storage.addInstallData(installData));
    }
    
    await Promise.all(installPromises);

    // Generate sample events
    const eventTypes = ['wallet_created', 'first_deposit', 'token_swap', 'high_value_action'];
    const eventPromises = [];
    
    for (let i = 0; i < 80; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const eventDate = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
      
      let eventParams = {};
      
      switch (eventType) {
        case 'first_deposit':
          eventParams = {
            deposit_amount: Math.floor(Math.random() * 500) + 50,
            deposit_token: 'USDT',
            event_category: 'monetization',
            value: Math.floor(Math.random() * 500) + 50
          };
          break;
        case 'token_swap':
          eventParams = {
            from_token: 'USDT',
            to_token: 'BNB',
            swap_amount: Math.floor(Math.random() * 200) + 25,
            event_category: 'trading',
            value: Math.floor(Math.random() * 200) + 25
          };
          break;
        case 'high_value_action':
          eventParams = {
            action_type: 'large_deposit',
            value: Math.floor(Math.random() * 1000) + 500,
            event_category: 'monetization'
          };
          break;
        case 'wallet_created':
          eventParams = {
            wallet_type: 'new',
            event_category: 'onboarding'
          };
          break;
      }
      
      const eventData = {
        event_name: eventType,
        event_params: eventParams,
        utm_source: source,
        utm_medium: source === 'organic' ? 'organic' : 'cpc',
        utm_campaign: source === 'organic' ? 'organic' : campaign,
        timestamp: eventDate.toISOString(),
        platform: Math.random() > 0.5 ? 'android' : 'ios',
        tracked_at: eventDate.toISOString()
      };
      
      eventPromises.push(storage.addEventData(eventData));
    }
    
    await Promise.all(eventPromises);
    
    // Lấy lại dữ liệu đã cập nhật
    analyticsData = await storage.getAnalyticsData();

    // Update dashboard totals
    analyticsData.dashboard.totalUsers = analyticsData.installs.length;
    
    // Calculate average revenue per user
    const totalRevenue = analyticsData.events
      .filter(e => e.event_params && e.event_params.value)
      .reduce((sum, e) => sum + e.event_params.value, 0);
    
    analyticsData.dashboard.avgRevenuePerUser = analyticsData.dashboard.totalUsers > 0 ? 
      totalRevenue / analyticsData.dashboard.totalUsers : 0;
      
    // Lưu cập nhật dashboard metrics
    await storage.updateAnalyticsData({ dashboard: analyticsData.dashboard });

    console.log('📊 Sample data generated:', {
      installs: analyticsData.installs.length,
      events: analyticsData.events.length,
      totalRevenue: totalRevenue
    });

    res.json({
      success: true,
      message: 'Sample data generated successfully',
      data: {
        installs: analyticsData.installs.length,
        events: analyticsData.events.length,
        total_revenue: totalRevenue
      }
    });
  } catch (error) {
    console.error('Error generating sample data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sample data',
      error: error.message
    });
  }
});

// DELETE /analytics/data - Clear all analytics data (for testing)
router.delete('/data', async (req, res) => {
  try {
    const storage = getStorage();
    await storage.clearAnalyticsData();
    
    res.json({
      success: true,
      message: 'Analytics data cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing analytics data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear analytics data',
      error: error.message
    });
  }
});

module.exports = router;
