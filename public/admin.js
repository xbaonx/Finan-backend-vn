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
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.dashboard.summary);
            loadDeposits();
            loadConfig();
            loadAppModeConfig(); // Tải cấu hình chế độ ứng dụng
        } else {
            console.error('Dashboard load failed:', data.message);
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

// Load deposits
async function loadDeposits() {
    const loading = document.getElementById('depositsLoading');
    const container = document.getElementById('depositsContainer');
    
    loading.classList.remove('hidden');
    
    try {
        const statusFilter = document.getElementById('depositStatusFilter').value;
        
        let url = `${API_BASE}/admin/orders?limit=50&type=deposit`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            displayOrders(data.orders, container, 'deposit');
        } else {
            container.innerHTML = '<p>Lỗi tải đơn nạp tiền</p>';
        }
    } catch (error) {
        console.error('Error loading deposits:', error);
        container.innerHTML = '<p>Lỗi kết nối</p>';
    } finally {
        loading.classList.add('hidden');
    }
}

// Load withdraws
async function loadWithdraws() {
    const loading = document.getElementById('withdrawsLoading');
    const container = document.getElementById('withdrawsContainer');
    
    loading.classList.remove('hidden');
    
    try {
        const statusFilter = document.getElementById('withdrawStatusFilter').value;
        
        let url = `${API_BASE}/admin/orders?limit=50&type=withdraw`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            displayOrders(data.orders, container, 'withdraw');
        } else {
            container.innerHTML = '<p>Lỗi tải đơn rút tiền</p>';
        }
    } catch (error) {
        console.error('Error loading withdraws:', error);
        container.innerHTML = '<p>Lỗi kết nối</p>';
    } finally {
        loading.classList.add('hidden');
    }
}

// Display orders table
function displayOrders(orders, container, orderType) {
    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #8E8E93; padding: 40px;">Không có đơn hàng nào</p>';
        return;
    }
    
    const table = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th><input type="checkbox" class="select-all-checkbox" onchange="toggleSelectAll('${orderType}')"></th>
                    <th>ID</th>
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
                        <td><input type="checkbox" class="bulk-checkbox" data-order-id="${order.id}" onchange="updateDeleteButton('${orderType}')"></td>
                        <td>
                            <span style="font-family: monospace; font-size: 12px; color: #666;">${order.id.substring(0, 8)}...</span>
                            <button class="copy-btn" onclick="copyToClipboard('${order.id}')">📋</button>
                        </td>
                        <td>
                            <span style="font-family: monospace; font-size: 12px;">${order.walletAddress.substring(0, 10)}...${order.walletAddress.substring(-6)}</span>
                            <button class="copy-btn" onclick="copyToClipboard('${order.walletAddress}')">📋</button>
                        </td>
                        <td><strong>${order.usdtAmount}</strong></td>
                        <td>${order.vndAmount?.toLocaleString() || 'N/A'}</td>
                        <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
                        <td>${new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>
                            <div class="action-buttons">
                                <select onchange="updateOrderStatus('${order.id}', this.value)" ${order.status === 'completed' ? 'disabled' : ''}>
                                    <option value="">Chọn hành động</option>
                                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                                    <option value="failed" ${order.status === 'failed' ? 'selected' : ''}>Thất bại</option>
                                </select>
                                <button class="delete-btn" onclick="deleteOrder('${orderType}', '${order.id}')">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

// Toggle select all checkboxes
function toggleSelectAll(orderType) {
    const containerSelector = orderType === 'deposit' ? '#depositsContainer' : '#withdrawsContainer';
    const selectAllCheckbox = document.querySelector(`${containerSelector} .select-all-checkbox`);
    const bulkCheckboxes = document.querySelectorAll(`${containerSelector} .bulk-checkbox`);
    
    bulkCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateDeleteButton(orderType);
}

// Update delete button state
function updateDeleteButton(orderType) {
    console.log('updateDeleteButton called with orderType:', orderType);
    
    const containerSelector = orderType === 'deposit' ? '#depositsContainer' : '#withdrawsContainer';
    const checkedBoxes = document.querySelectorAll(`${containerSelector} .bulk-checkbox:checked`);
    const buttonId = `deleteSelected${orderType === 'deposit' ? 'Deposits' : 'Withdraws'}`;
    const deleteButton = document.getElementById(buttonId);
    
    console.log('containerSelector:', containerSelector);
    console.log('checkedBoxes count:', checkedBoxes.length);
    console.log('buttonId:', buttonId);
    console.log('deleteButton found:', !!deleteButton);
    
    if (deleteButton) {
        deleteButton.disabled = checkedBoxes.length === 0;
        console.log('Button disabled:', deleteButton.disabled);
    }
}

// Delete single order
async function deleteOrder(orderType, orderId) {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderType}/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('configSuccess', 'Đã xóa đơn hàng thành công!');
            if (orderType === 'deposit') {
                loadDeposits();
            } else {
                loadWithdraws();
            }
            loadDashboard(); // Refresh stats
        } else {
            showError('configError', data.message || 'Không thể xóa đơn hàng');
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        showError('configError', 'Error deleting order: ' + error.message);
    }
}

// Delete selected orders
async function deleteSelectedOrders(orderType) {
    console.log('deleteSelectedOrders called with orderType:', orderType);
    
    const containerSelector = orderType === 'deposit' ? '#depositsContainer' : '#withdrawsContainer';
    console.log('containerSelector:', containerSelector);
    
    const checkedBoxes = document.querySelectorAll(`${containerSelector} .bulk-checkbox:checked`);
    console.log('checkedBoxes found:', checkedBoxes.length);
    
    const orderIds = Array.from(checkedBoxes).map(cb => cb.dataset.orderId);
    console.log('orderIds:', orderIds);
    
    if (orderIds.length === 0) {
        alert('Vui lòng chọn ít nhất một đơn hàng để xóa');
        return;
    }
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${orderIds.length} đơn hàng đã chọn?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderType}/bulk`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderIds })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('configSuccess', `Đã xóa ${data.deletedCount} đơn hàng thành công!`);
            if (orderType === 'deposit') {
                loadDeposits();
            } else {
                loadWithdraws();
            }
            loadDashboard(); // Refresh stats
        } else {
            showError('configError', data.message || 'Không thể xóa đơn hàng');
        }
    } catch (error) {
        console.error('Error bulk deleting orders:', error);
        showError('configError', 'Error deleting orders: ' + error.message);
    }
}

// Update order status
async function updateOrderStatus(orderId, newStatus, orderType) {
    try {
        const notes = prompt('Ghi chú (tùy chọn):');
        
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus, notes })
        });
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            loadDeposits(); // Reload orders
            loadDashboard(); // Reload stats
        } else {
            alert('Lỗi cập nhật trạng thái: ' + data.message);
        }
    } catch (error) {
        alert('Lỗi cập nhật trạng thái: ' + error.message);
    }
}

// Load config
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/admin/config`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update exchange rate display - check if element exists
            const currentRateEl = document.getElementById('currentRate');
            if (currentRateEl) {
                currentRateEl.textContent = data.config.exchangeRates.USD_TO_VND.toLocaleString();
            }
            
            // Update swap config display - check if elements exist
            const swapConfig = data.config.swapConfig;
            const platformFeeEl = document.getElementById('platformFee');
            const minSwapEl = document.getElementById('minSwap');
            const maxSwapEl = document.getElementById('maxSwap');
            
            if (platformFeeEl) platformFeeEl.value = swapConfig.platformFeePercentage;
            if (minSwapEl) minSwapEl.value = swapConfig.minSwapAmount;
            if (maxSwapEl) maxSwapEl.value = swapConfig.maxSwapAmount;
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

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load data for specific tabs
    if (tabName === 'deposits') {
        loadDeposits();
    } else if (tabName === 'withdraws') {
        loadWithdraws();
    } else if (tabName === 'config') {
        loadConfig();
    } else if (tabName === 'stats') {
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

// Handle authentication errors
function handleAuthError() {
    console.log('Authentication failed - redirecting to login');
    localStorage.removeItem('adminToken');
    authToken = null;
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    showError('loginError', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
}

// Copy to clipboard function
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text)
        .then(() => {
            // Change button appearance temporarily
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');
            
            // Reset button after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('copied');
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            alert('Không thể sao chép địa chỉ ví!');
        });
}

// Load app mode config
async function loadAppModeConfig() {
    try {
        const response = await fetch(`${API_BASE}/admin/app-mode`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update toggle switches
            document.getElementById('reviewModeToggle').checked = data.appMode.isReviewMode;
            document.getElementById('productionModeToggle').checked = data.appMode.isProductionMode;
            
            // Update status text
            document.getElementById('reviewModeStatus').textContent = 
                data.appMode.isReviewMode ? 'Đang bật' : 'Đang tắt';
            document.getElementById('productionModeStatus').textContent = 
                data.appMode.isProductionMode ? 'Đang bật' : 'Đang tắt';
        } else {
            console.error('Failed to load app mode config:', data.message);
        }
    } catch (error) {
        console.error('Error loading app mode config:', error);
    }
}

// Update app mode config
async function updateAppMode() {
    try {
        const isReviewMode = document.getElementById('reviewModeToggle').checked;
        const isProductionMode = document.getElementById('productionModeToggle').checked;
        
        const response = await fetch(`${API_BASE}/admin/app-mode`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                isReviewMode,
                isProductionMode
            })
        });
        
        if (response.status === 401) {
            handleAuthError();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('configSuccess', 'Cập nhật chế độ ứng dụng thành công!');
            
            // Update status text
            document.getElementById('reviewModeStatus').textContent = 
                isReviewMode ? 'Đang bật' : 'Đang tắt';
            document.getElementById('productionModeStatus').textContent = 
                isProductionMode ? 'Đang bật' : 'Đang tắt';
                
            // Thông báo cho người dùng rằng trạng thái đã được lưu trên disk
            console.log('Trạng thái chế độ ứng dụng đã được lưu trên disk của Render');
        } else {
            showError('configError', `Lỗi: ${data.message || 'Không thể cập nhật chế độ ứng dụng'}`);
        }
    } catch (error) {
        showError('configError', `Lỗi kết nối: ${error.message}`);
    }
}

// Make functions global for onclick handlers
window.showTab = showTab;
window.updateOrderStatus = updateOrderStatus;
window.updateExchangeRate = updateExchangeRate;
window.updateSwapConfig = updateSwapConfig;
window.copyToClipboard = copyToClipboard;
window.updateAppMode = updateAppMode;
// Remove undefined loadOrders reference
// window.loadOrders = loadOrders;
