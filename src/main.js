import {
  login,
  registerOwner,
  verifySession,
  fetchParcels,
  saveParcels,
  markReceived,
  clearAllParcels,
  saveDormSettings,
  addStaff,
  aiScanBatch
} from './api.js';
import { createLineMessage } from './utils.js';
import { startCamera, stopCamera, captureImageToBase64 } from './camera.js';
import { showToast } from './ui.js';

let currentUser = null;
let currentInventory = [];
let currentScannedRows = [];
let capturedBase64List = [];
let activeCameraStream = null;

const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const appDormName = document.getElementById('appDormName');
const appUsername = document.getElementById('appUsername');
const logoutBtn = document.getElementById('logoutBtn');
const cameraBtn = document.getElementById('cameraBtn');
const uploadBtn = document.getElementById('uploadBtn');
const uploadInput = document.getElementById('uploadInput');
const previewPanel = document.getElementById('previewPanel');
const thumbnails = document.getElementById('thumbnails');
const clearCapturedBtn = document.getElementById('clearCapturedBtn');
const scanBtn = document.getElementById('scanBtn');
const lineCountBadge = document.getElementById('lineCountBadge');
const lineMessage = document.getElementById('lineMessage');
const lineMessagePanel = document.getElementById('lineMessagePanel');
const inspectionPanel = document.getElementById('inspectionPanel');
const inspectionTableBody = document.getElementById('inspectionTableBody');
const inventoryTableBody = document.getElementById('inventoryTableBody');
const inventorySearch = document.getElementById('inventorySearch');
const saveToSheetBtn = document.getElementById('saveToSheetBtn');
const generateMessageBtn = document.getElementById('generateMessageBtn');
const copyLineBtn = document.getElementById('copyLineBtn');
const shareLineBtn = document.getElementById('shareLineBtn');
const addManualRowBtn = document.getElementById('addManualRowBtn');
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCount = document.getElementById('cameraCount');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    currentUser = await login(username, password);
    showApp();
    await loadInventory();
  } catch (err) {
    showToast(err.message || 'login failed', 'error');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dormName = document.getElementById('regDormName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  try {
    currentUser = await registerOwner(dormName, username, password);
    showApp();
    await loadInventory();
  } catch (err) {
    showToast(err.message || 'register failed', 'error');
  }
});

tabLoginBtn.addEventListener('click', () => {
  tabLoginBtn.className = 'flex-1 border-b-2 border-indigo-600 py-2 text-indigo-600';
  tabRegisterBtn.className = 'flex-1 py-2 text-slate-400';
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

tabRegisterBtn.addEventListener('click', () => {
  tabRegisterBtn.className = 'flex-1 border-b-2 border-indigo-600 py-2 text-indigo-600';
  tabLoginBtn.className = 'flex-1 py-2 text-slate-400';
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('smart_parcel_token');
  currentUser = null;
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
});

cameraBtn.addEventListener('click', async () => {
  cameraModal.classList.remove('hidden');
  try {
    activeCameraStream = await startCamera(cameraVideo);
  } catch (err) {
    showToast('ไม่สามารถเปิดกล้องได้', 'error');
    closeCamera();
  }
});

document.getElementById('closeCameraBtn').addEventListener('click', closeCamera);
document.getElementById('finishCameraBtn').addEventListener('click', closeCamera);

document.getElementById('takeSnapshotBtn').addEventListener('click', () => {
  const data = captureImageToBase64(cameraVideo);
  capturedBase64List.push(data);
  cameraCount.textContent = `${capturedBase64List.length} รูป`;
  renderThumbnails();
});

uploadBtn.addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const data = await fileToBase64(file);
    capturedBase64List.push(data);
  }
  renderThumbnails();
});

clearCapturedBtn.addEventListener('click', () => {
  capturedBase64List = [];
  renderThumbnails();
});

scanBtn.addEventListener('click', async () => {
  if (!capturedBase64List.length) {
    showToast('กรุณาเลือกรูปก่อน', 'error');
    return;
  }

  try {
    const rows = await aiScanBatch(capturedBase64List);
    currentScannedRows = rows.map(item => ({
      target: item.target || 'ไม่ระบุ',
      courier: item.courier || 'Other',
      cod: item.cod || 'None'
    }));
    renderInspectionTable();
    generateLineMessage();
    showToast('ประมวลผลสำเร็จ', 'info');
  } catch (err) {
    showToast(err.message || 'AI scan failed', 'error');
  }
});

addManualRowBtn.addEventListener('click', () => {
  currentScannedRows.push({ target: 'ห้อง...', courier: 'Other', cod: 'None' });
  renderInspectionTable();
  generateLineMessage();
});

saveToSheetBtn.addEventListener('click', async () => {
  if (!currentUser || !currentScannedRows.length) return;

  try {
    await saveParcels(currentUser.dormId, currentScannedRows.map(row => ({
      id: 'pkg_' + crypto.randomUUID(),
      dormName: currentUser.dormName,
      target: row.target,
      courier: row.courier,
      cod: row.cod,
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    })));

    await loadInventory();
    showToast('บันทึกลงชีตเรียบร้อยแล้ว', 'info');
  } catch (err) {
    showToast(err.message || 'save failed', 'error');
  }
});

generateMessageBtn.addEventListener('click', generateLineMessage);

copyLineBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lineMessage.value);
    showToast('คัดลอกข้อความสำเร็จ', 'info');
  } catch (err) {
    showToast('ไม่สามารถคัดลอกได้', 'error');
  }
});

shareLineBtn.addEventListener('click', () => {
  const msg = encodeURIComponent(lineMessage.value.trim());
  window.location.href = `https://line.me/R/msg/text/?${msg}`;
});

inventorySearch.addEventListener('input', renderInventoryTable);

async function initApp() {
  const savedUser = await verifySession();
  if (savedUser) {
    currentUser = savedUser;
    showApp();
    await loadInventory();
  } else {
    authScreen.classList.remove('hidden');
  }
}

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  appDormName.textContent = currentUser.dormName;
  appUsername.textContent = currentUser.username;
}

async function loadInventory() {
  if (!currentUser) return;

  try {
    currentInventory = await fetchParcels(currentUser.dormId);
    renderInventoryTable();
  } catch (err) {
    showToast(err.message || 'load inventory failed', 'error');
  }
}

function renderThumbnails() {
  previewPanel.classList.toggle('hidden', capturedBase64List.length === 0);
  thumbnails.innerHTML = '';

  capturedBase64List.forEach(blob => {
    const div = document.createElement('div');
    div.className = 'overflow-hidden rounded-lg border border-slate-200 bg-slate-50';
    div.innerHTML = `<img src="data:image/jpeg;base64,${blob}" class="h-20 w-full object-cover" />`;
    thumbnails.appendChild(div);
  });
}

function renderInspectionTable() {
  inspectionPanel.classList.toggle('hidden', currentScannedRows.length === 0);
  inspectionTableBody.innerHTML = '';

  currentScannedRows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-2 py-2">
        <input data-index="${index}" data-field="target" value="${row.target}" class="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1" />
      </td>
      <td class="px-2 py-2">
        <select data-index="${index}" data-field="courier" class="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1">
          ${['SPX', 'Flash', 'J&T', 'KEX', 'EMS', 'Other'].map(opt => `
            <option value="${opt}" ${row.courier === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </td>
      <td class="px-2 py-2">
        <input data-index="${index}" data-field="cod" value="${row.cod}" class="w-20 rounded border border-slate-200 bg-slate-50 px-2 py-1" />
      </td>
      <td class="px-2 py-2 text-right">
        <button data-index="${index}" class="remove-row-btn text-rose-500">×</button>
      </td>
    `;
    inspectionTableBody.appendChild(tr);
  });

  inspectionTableBody.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', (event) => {
      const idx = Number(event.target.dataset.index);
      const field = event.target.dataset.field;
      currentScannedRows[idx][field] = event.target.value;
      generateLineMessage();
    });
  });

  inspectionTableBody.querySelectorAll('.remove-row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      currentScannedRows.splice(idx, 1);
      renderInspectionTable();
      generateLineMessage();
    });
  });
}

function generateLineMessage() {
  if (!currentScannedRows.length) {
    lineMessagePanel.classList.add('hidden');
    return;
  }

  lineMessagePanel.classList.remove('hidden');
  const header = currentUser?.tplHeader || '━━━━━━━━━━━━━━━\n📦 แจ้งเตือนพัสดุเข้า';
  const footer = currentUser?.tplFooter || '━━━━━━━━━━━━━━━\n📍 จุดรับ: ออฟฟิศ';

  const text = createLineMessage(currentScannedRows, header, footer);
  lineMessage.value = text;
  lineCountBadge.textContent = `${currentScannedRows.length} ชิ้น`;
}

function renderInventoryTable() {
  const query = inventorySearch.value.trim().toLowerCase();
  const rows = currentInventory.filter(item => {
    if (!item || !item.target) return false;
    return String(item.target).toLowerCase().includes(query);
  });

  inventoryTableBody.innerHTML = '';

  if (!rows.length) {
    inventoryTableBody.innerHTML = '<tr><td colspan="4" class="px-2 py-6 text-center text-xs text-slate-400">ไม่มีพัสดุค้างรับ</td></tr>';
    return;
  }

  rows.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-2 py-2 font-semibold">${item.target}</td>
      <td class="px-2 py-2">${item.date}</td>
      <td class="px-2 py-2">
        <span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">${item.status || 'pending'}</span>
      </td>
      <td class="px-2 py-2">
        <button data-id="${item.id}" class="receive-btn rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">รับแล้ว</button>
      </td>
    `;
    inventoryTableBody.appendChild(tr);
  });

  inventoryTableBody.querySelectorAll('.receive-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      try {
        await markReceived(currentUser.dormId, id);
        await loadInventory();
        showToast('ทำเครื่องหมายรับแล้ว', 'info');
      } catch (err) {
        showToast(err.message || 'mark failed', 'error');
      }
    });
  });
}

function closeCamera() {
  if (activeCameraStream) {
    stopCamera(activeCameraStream);
    activeCameraStream = null;
  }
  cameraModal.classList.add('hidden');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error('file read failed'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

initApp();
