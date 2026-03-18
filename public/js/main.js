// API Base URL
const API_BASE = '/api';

// Utility Functions
function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(angka);
}

function showAlert(message, type = 'success') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  const container = document.querySelector('.main-content') || document.querySelector('.auth-container');
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => alertDiv.remove(), 5000);
}

function showLoading() {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'spinner';
  loadingDiv.id = 'loading-spinner';
  return loadingDiv;
}

function hideLoading() {
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.remove();
}

// Auth Functions
async function login(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  try {
    showLoading();
    
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      showAlert(data.message, 'error');
    }
  } catch (error) {
    showAlert('Terjadi kesalahan', 'error');
  } finally {
    hideLoading();
  }
}

async function register(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  try {
    showLoading();
    
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullname: formData.get('fullname'),
        username: formData.get('username'),
        email: formData.get('email'),
        nomor: formData.get('nomor'),
        password: formData.get('password')
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showAlert('Registrasi berhasil! Silakan login.');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } else {
      showAlert(data.message, 'error');
    }
  } catch (error) {
    showAlert('Terjadi kesalahan', 'error');
  } finally {
    hideLoading();
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Check Auth
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) {
    window.location.href = '/';
    return null;
  }
  
  return { token, user };
}

// API Call with Auth
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  
  return response.json();
}

// Dashboard Functions
async function loadDashboard() {
  const auth = checkAuth();
  if (!auth) return;
  
  // Load profile
  const profile = await apiCall('/auth/me');
  if (profile.success) {
    document.getElementById('profile-name').textContent = profile.user.fullname;
    document.getElementById('profile-username').textContent = profile.user.username;
    document.getElementById('profile-email').textContent = profile.user.email;
    document.getElementById('profile-nomor').textContent = profile.user.nomor;
    document.getElementById('profile-saldo').textContent = formatRupiah(profile.user.saldo);
  }
  
  // Load deposits
  // Load withdrawals
  // etc
}

// Deposit Functions
async function createDeposit(event) {
  event.preventDefault();
  
  const form = event.target;
  const nominal = form.nominal.value;
  
  try {
    showLoading();
    
    const data = await apiCall('/deposit/create', {
      method: 'POST',
      body: JSON.stringify({ nominal })
    });
    
    if (data.success) {
      // Show QR Code
      showQRCode(data.data);
    } else {
      showAlert(data.message, 'error');
    }
  } catch (error) {
    showAlert('Gagal membuat deposit', 'error');
  } finally {
    hideLoading();
  }
}

function showQRCode(deposit) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="qr-container">
        <img src="${deposit.qrImage}" alt="QRIS">
        <div class="nominal-display">
          <div class="amount">${formatRupiah(deposit.totalBayar)}</div>
          <div>(Termasuk fee ${formatRupiah(deposit.fee)})</div>
        </div>
        <div class="qr-actions">
          <button class="btn btn-primary" onclick="checkStatus('${deposit.id}')">
            CEK STATUS
          </button>
          <button class="btn btn-outline" onclick="cancelDeposit('${deposit.id}')">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function checkStatus(depositId) {
  try {
    const data = await apiCall('/deposit/status', {
      method: 'POST',
      body: JSON.stringify({ depositId })
    });
    
    if (data.success) {
      showAlert(`Status: ${data.data.status}`, 
        data.data.status === 'success' ? 'success' : 'warning');
      
      if (data.data.status === 'success') {
        setTimeout(() => location.reload(), 2000);
      }
    }
  } catch (error) {
    showAlert('Gagal cek status', 'error');
  }
}

async function cancelDeposit(depositId) {
  if (!confirm('Yakin ingin membatalkan deposit?')) return;
  
  try {
    const data = await apiCall('/deposit/cancel', {
      method: 'POST',
      body: JSON.stringify({ depositId })
    });
    
    if (data.success) {
      showAlert('Deposit dibatalkan');
      setTimeout(() => location.reload(), 1500);
    }
  } catch (error) {
    showAlert('Gagal membatalkan', 'error');
  }
}

// Withdraw Functions
async function createWithdraw(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  try {
    showLoading();
    
    const data = await apiCall('/withdraw/create', {
      method: 'POST',
      body: JSON.stringify({
        nominal: formData.get('nominal'),
        bank: formData.get('bank'),
        nomorRekening: formData.get('nomorRekening'),
        atasNama: formData.get('atasNama')
      })
    });
    
    if (data.success) {
      showAlert('Permintaan penarikan berhasil diajukan');
      setTimeout(() => location.reload(), 2000);
    } else {
      showAlert(data.message, 'error');
    }
  } catch (error) {
    showAlert('Gagal mengajukan penarikan', 'error');
  } finally {
    hideLoading();
  }
}

// API Key Functions
async function generateApiKey() {
  if (!confirm('Generate API Key baru? API Key lama akan tidak bisa digunakan.')) return;
  
  try {
    showLoading();
    
    const data = await apiCall('/apikey/generate', {
      method: 'POST'
    });
    
    if (data.success) {
      document.getElementById('api-key').textContent = data.apiKey;
      showAlert('API Key berhasil digenerate');
    }
  } catch (error) {
    showAlert('Gagal generate API Key', 'error');
  } finally {
    hideLoading();
  }
}

function copyApiKey() {
  const apiKey = document.getElementById('api-key').textContent;
  navigator.clipboard.writeText(apiKey);
  showAlert('API Key copied!');
}

// Admin Functions
async function loadAdminDashboard() {
  const auth = checkAuth();
  if (!auth || auth.user.role !== 'admin') {
    window.location.href = '/dashboard';
    return;
  }
  
  // Load stats
  const stats = await apiCall('/admin/stats');
  if (stats.success) {
    document.getElementById('stat-total-users').textContent = stats.data.totalUsers;
    document.getElementById('stat-total-saldo').textContent = formatRupiah(stats.data.totalSaldo);
    document.getElementById('stat-total-deposit').textContent = formatRupiah(stats.data.totalDeposit);
    document.getElementById('stat-total-profit').textContent = formatRupiah(stats.data.totalProfit);
    document.getElementById('stat-pending-withdrawals').textContent = stats.data.pendingWithdrawals;
  }
  
  // Load withdrawals
  loadWithdrawals();
}

async function loadWithdrawals() {
  const data = await apiCall('/admin/withdrawals');
  
  if (data.success) {
    const tbody = document.getElementById('withdrawals-table');
    tbody.innerHTML = '';
    
    data.data.forEach(w => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(w.createdAt).toLocaleString('id-ID')}</td>
        <td>${w.username}</td>
        <td>${formatRupiah(w.nominal)}</td>
        <td>${w.bank} - ${w.nomorRekening} (${w.atasNama})</td>
        <td><span class="badge badge-${w.status}">${w.status}</span></td>
        <td>
          ${w.status === 'pending' ? `
            <button class="btn btn-small btn-success" onclick="confirmWithdraw('${w._id}')">
              Confirm
            </button>
            <button class="btn btn-small btn-danger" onclick="rejectWithdraw('${w._id}')">
              Reject
            </button>
          ` : '-'}
        </td>
      `;
      tbody.appendChild(row);
    });
  }
}

async function confirmWithdraw(id) {
  if (!confirm('Konfirmasi penarikan ini?')) return;
  
  const data = await apiCall('/admin/withdrawals', {
    method: 'POST',
    body: JSON.stringify({ withdrawId: id, action: 'confirm' })
  });
  
  if (data.success) {
    showAlert('Penarikan dikonfirmasi');
    loadWithdrawals();
    loadAdminDashboard();
  }
}

async function rejectWithdraw(id) {
  if (!confirm('Tolak penarikan ini? Saldo akan dikembalikan.')) return;
  
  const data = await apiCall('/admin/withdrawals', {
    method: 'POST',
    body: JSON.stringify({ withdrawId: id, action: 'reject' })
  });
  
  if (data.success) {
    showAlert('Penarikan ditolak');
    loadWithdrawals();
    loadAdminDashboard();
  }
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  
  if (path === '/dashboard') {
    loadDashboard();
  } else if (path === '/admin') {
    loadAdminDashboard();
  }
  
  // Set current year in footer
  const yearElement = document.getElementById('current-year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
});