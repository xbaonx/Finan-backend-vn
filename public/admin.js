const API_BASE = 'https://finan-backend-vn.onrender.com/api/v1';
let authToken = localStorage.getItem('adminToken');
let currentOrders = [];

// Check if already logged in
if (authToken) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    loadDashboard();
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('dashboardSection').classList.remove('hidden');
            loadDashboard();
        } else {
            showError('loginError', data.message || 'Đăng nhập thất bại');
        }
    } catch (error) {
        showError('loginError', 'Lỗi kết nối: ' + error.message);
    }
});

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    authToken = null;
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
});

// Load dashboard data
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.dashboard.summary);
            loadOrders();
            loadConfig();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Update stats display
function updateStats(summary) {
    document.getElementById('totalDeposits').textContent = summary.totalDeposits || 0;
    document.getElementById('totalWithdraws').textContent = summary.totalWithdraws || 0;
    document.getElementById('pendingOrders').textContent = (summary.pendingDeposits || 0) + (summary.pendingWithdraws || 0);
    document.getElementById('totalUSDT').textContent = `${(summary.totalUSDTDeposited || 0).toFixed(2)}`;
}

// Load orders
async function loadOrders() {
    const loading = document.getElementById('ordersLoading');
    const container = document.getElementById('ordersContainer');
    
    loading.classList.remove('hidden');
    
    try {
        const typeFilter = document.getElementById('orderTypeFilter').value;
        const statusFilter = document.getElementById('orderStatusFilter').value;
        
        let url = `${API_BASE}/admin/orders?limit=50`;
        if (typeFilter) url += `&type=${typeFilter}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentOrders = data.orders;
            displayOrders(data.orders);
        }
    } catch (error) {
        container.innerHTML = `<div class="error">Lỗi tải đơn hàng: ${error.message}</div>`;
    } finally {
        loading.classList.add('hidden');
    }
}

// Display orders table
function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    
    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #8E8E93; padding: 40px;">Không có đơn hàng nào</p>';
        return;
    }
    
    const table = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Loại</th>
                    <th>Địa chỉ ví</th>
                    <th>USDT</th>
                    <th>VND</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Hành động</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(order => `
                    <tr>
                        <td>${order.id.substring(0, 8)}...</td>
                        <td>${order.type === 'deposit' ? '📥 Nạp' : '📤 Rút'}</td>
                        <td>${order.walletAddress.substring(0, 10)}...</td>
                        <td>${order.usdtAmount}</td>
                        <td>${order.vndAmount?.toLocaleString()}</td>
                        <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
                        <td>${new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>
                            <select onchange="updateOrderStatus('${order.id}', this.value, '${order.type}')">
                                <option value="">Chọn trạng thái</option>
                                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                                <option value="failed" ${order.status === 'failed' ? 'selected' : ''}>Thất bại</option>
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                            </select>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// Update order status
async function updateOrderStatus(orderId, newStatus, orderType) {
    if (!newStatus) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('configSuccess', `Đã cập nhật trạng thái đơn hàng thành công`);
            loadOrders(); // Reload orders
            loadDashboard(); // Reload stats
        } else {
            showError('configError', data.message || 'Cập nhật thất bại');
        }
    } catch (error) {
        showError('configError', 'Lỗi cập nhật: ' + error.message);
    }
}

// Load config
async function loadConfig() {
    try {
        // Load exchange rates
        const ratesResponse = await fetch(`${API_BASE}/deposit-withdraw/rates`);
        const ratesData = await ratesResponse.json();
        if (ratesData.success) {
            document.getElementById('exchangeRate').value = ratesData.rates.usdToVnd;
        }

        // Load swap config
        const swapResponse = await fetch(`${API_BASE}/swap/config`);
        const swapData = await swapResponse.json();
        if (swapData.success) {
            document.getElementById('platformFee').value = swapData.config.platformFeePercentage;
            document.getElementById('minSwapAmount').value = swapData.config.minSwapAmount;
            document.getElementById('maxSwapAmount').value = swapData.config.maxSwapAmount;
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Update exchange rate
async function updateExchangeRate() {
    const rate = document.getElementById('exchangeRate').value;
    if (!rate) return;

    try {
        const response = await fetch(`${API_BASE}/admin/exchange-rates`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ USD_TO_VND: parseFloat(rate) })
        });

        const data = await response.json();
        if (data.success) {
            showSuccess('configSuccess', 'Cập nhật tỷ giá thành công');
        } else {
            showError('configError', data.message || 'Cập nhật thất bại');
        }
    } catch (error) {
        showError('configError', 'Lỗi cập nhật: ' + error.message);
    }
}

// Update swap config
async function updateSwapConfig() {
    const platformFee = document.getElementById('platformFee').value;
    const minAmount = document.getElementById('minSwapAmount').value;
    const maxAmount = document.getElementById('maxSwapAmount').value;

    const updateData = {};
    if (platformFee) updateData.platformFeePercentage = parseFloat(platformFee);
    if (minAmount) updateData.minSwapAmount = parseFloat(minAmount);
    if (maxAmount) updateData.maxSwapAmount = parseFloat(maxAmount);

    try {
        const response = await fetch(`${API_BASE}/admin/swap-config`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        if (data.success) {
            showSuccess('configSuccess', 'Cập nhật cấu hình swap thành công');
        } else {
            showError('configError', data.message || 'Cập nhật thất bại');
        }
    } catch (error) {
        showError('configError', 'Lỗi cập nhật: ' + error.message);
    }
}

// Tab navigation
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Add active class to clicked tab
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');

    // Load tab-specific data
    if (tabName === 'stats') {
        loadDetailedStats();
    }
}

// Load detailed stats
async function loadDetailedStats() {
    const container = document.getElementById('detailedStats');
    
    try {
        const response = await fetch(`${API_BASE}/admin/stats?period=7d`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            container.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${stats.deposits.total}</h3>
                        <p>Đơn nạp (7 ngày)</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.withdraws.total}</h3>
                        <p>Đơn rút (7 ngày)</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.deposits.totalUSDT.toFixed(2)}</h3>
                        <p>USDT đã nạp</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.withdraws.totalUSDT.toFixed(2)}</h3>
                        <p>USDT đã rút</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `<div class="error">Lỗi tải thống kê: ${error.message}</div>`;
    }
}

// Utility functions
function getStatusText(status) {
    const statusMap = {
        'pending': 'Chờ xử lý',
        'completed': 'Hoàn thành',
        'failed': 'Thất bại',
        'cancelled': 'Đã hủy'
    };
    return statusMap[status] || status;
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 5000);
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden');
    setTimeout(() => element.classList.add('hidden'), 3000);
}

// Make functions global for onclick handlers
window.showTab = showTab;
window.updateOrderStatus = updateOrderStatus;
window.updateExchangeRate = updateExchangeRate;
window.updateSwapConfig = updateSwapConfig;
window.loadOrders = loadOrders;
