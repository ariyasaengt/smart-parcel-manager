/**
 * Smart Parcel Manager - Full Apps Script backend
 * Works with:
 * - login / register / verify session
 * - save parcels / fetch parcels / receive parcel / clear all
 * - save dorm settings
 * - add staff
 * - AI scan batch using Gemini
 *
 * IMPORTANT:
 * Add in Apps Script -> Project Settings -> Script Properties:
 *   Name: GEMINI_API_KEY
 *   Value: <your actual Gemini API key>
 */

const SPREADSHEET_ID = '1or_rx4GZ9Tjg1bFPncpkTFwKtKenh3tbkhSWTEcePUE';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const AI_MODEL = 'gemini-2.0-flash';

function SS() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  try {
    const q = e.parameter || {};
    const action = q.action || '';
    const dormId = q.dormId;

    if (action === 'fetch_parcels' || dormId) {
      if (!dormId) {
        return jsonResponse({ status: 'error', message: 'missing dormId' });
      }
      return jsonResponse({ status: 'success', data: getParcels(dormId) });
    }

    return jsonResponse({ status: 'error', message: 'unknown GET action' });
  } catch (err) {
    console.error(err);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function doPost(e) {
  try {
    const text = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(text || '{}');
    const action = payload.action;

    if (!action) {
      return jsonResponse({ status: 'error', message: 'missing action' });
    }

    switch (action) {
      case 'login':
        return handleLogin(payload);
      case 'verify_session':
        return handleVerifySession(payload);
      case 'register_owner':
        return handleRegister(payload);
      case 'save_parcels':
        return handleSaveParcels(payload);
      case 'fetch_parcels':
        return jsonResponse({ status: 'success', data: getParcels(payload.dormId || '') });
      case 'mark_received':
        return handleMarkReceived(payload);
      case 'clear_all_parcels':
        return handleClearParcels(payload);
      case 'save_dorm_settings':
        return handleSaveSettings(payload);
      case 'add_staff':
        return handleAddStaff(payload);
      case 'ai_scan_batch':
        return handleAiScanBatch(payload);
      default:
        return jsonResponse({ status: 'error', message: 'unknown action' });
    }
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

function handleLogin(payload) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '').trim();

  if (!username || !password) {
    return jsonResponse({ status: 'error', message: 'missing username/password' });
  }

  ensureSheetsExist();
  const users = getSheetData('users');
  const row = users.find(u => u[0] === username && u[1] === hashPassword(password));
  if (!row) {
    return jsonResponse({ status: 'error', message: 'username or password incorrect' });
  }

  const dormId = row[2];
  const dormName = row[3];
  const role = row[4] || 'owner';
  const token = createSession(username, dormId);
  const tplHeader = getSetting(dormId, 'tplHeader') || defaultHeader();
  const tplFooter = getSetting(dormId, 'tplFooter') || defaultFooter();

  return jsonResponse({
    status: 'success',
    token,
    user: {
      username,
      dormId,
      dormName,
      role,
      tplHeader,
      tplFooter
    }
  });
}

function handleVerifySession(payload) {
  const token = payload.token;
  if (!token) {
    return jsonResponse({ status: 'error', message: 'missing token' });
  }

  const session = verifySession(token);
  if (!session) {
    return jsonResponse({ status: 'error', message: 'invalid or expired session' });
  }

  const users = getSheetData('users');
  const row = users.find(u => u[0] === session.username && u[2] === session.dormId);
  if (!row) {
    return jsonResponse({ status: 'error', message: 'user not found' });
  }

  const dormId = session.dormId;
  const tplHeader = getSetting(dormId, 'tplHeader') || defaultHeader();
  const tplFooter = getSetting(dormId, 'tplFooter') || defaultFooter();

  return jsonResponse({
    status: 'success',
    user: {
      username: session.username,
      dormId,
      dormName: row[3],
      role: row[4] || 'owner',
      tplHeader,
      tplFooter
    }
  });
}

function handleRegister(payload) {
  const dormName = String(payload.dormName || '').trim();
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '').trim();

  if (!dormName || !username || !password) {
    return jsonResponse({ status: 'error', message: 'missing dormName / username / password' });
  }

  ensureSheetsExist();
  const users = getSheetData('users');
  if (users.some(u => u[0] === username)) {
    return jsonResponse({ status: 'error', message: 'username already exists' });
  }

  const dormId = 'dorm_' + Date.now().toString(36);
  appendRow('dorms', [dormId, dormName, new Date().toISOString()]);
  appendRow('users', [username, hashPassword(password), dormId, dormName, 'owner']);
  appendRow('settings', [dormId, defaultHeader(), defaultFooter()]);

  const token = createSession(username, dormId);

  return jsonResponse({
    status: 'success',
    token,
    user: {
      username,
      dormId,
      dormName,
      role: 'owner',
      tplHeader: defaultHeader(),
      tplFooter: defaultFooter()
    }
  });
}

function handleSaveParcels(payload) {
  const dormId = payload.dormId;
  const items = payload.items;
  const token = payload.token;

  if (!dormId || !Array.isArray(items)) {
    return jsonResponse({ status: 'error', message: 'missing dormId or items' });
  }

  if (!validateToken(token)) {
    return jsonResponse({ status: 'error', message: 'authentication required' });
  }

  ensureSheetsExist();

  items.forEach(item => {
    const id = item.id || generateId();
    const dormName = item.dormName || getDormName(dormId) || '';
    const target = String(item.target || '').trim();
    const courier = item.courier || 'Other';
    const cod = item.cod || 'None';
    const date = item.date || new Date().toISOString().split('T')[0];
    const status = item.status || 'pending';

    appendRow('parcels', [id, dormId, dormName, target, courier, cod, date, status]);
  });

  return jsonResponse({ status: 'success' });
}

function handleMarkReceived(payload) {
  const { id, dormId, token } = payload || {};
  if (!id || !dormId) {
    return jsonResponse({ status: 'error', message: 'missing id or dormId' });
  }

  if (!validateToken(token)) {
    return jsonResponse({ status: 'error', message: 'authentication required' });
  }

  const sheet = SS().getSheetByName('parcels');
  if (!sheet) {
    return jsonResponse({ status: 'error', message: 'parcels sheet missing' });
  }

  const rows = sheet.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][0]) === String(id) && String(rows[r][1]) === String(dormId)) {
      sheet.getRange(r + 1, 8).setValue('received');
      return jsonResponse({ status: 'success' });
    }
  }

  return jsonResponse({ status: 'error', message: 'parcel not found' });
}

function handleClearParcels(payload) {
  const { dormId, token } = payload || {};
  if (!dormId) {
    return jsonResponse({ status: 'error', message: 'missing dormId' });
  }

  if (!validateToken(token)) {
    return jsonResponse({ status: 'error', message: 'authentication required' });
  }

  const sheet = SS().getSheetByName('parcels');
  if (!sheet) {
    return jsonResponse({ status: 'error', message: 'parcels sheet missing' });
  }

  const rows = sheet.getDataRange().getValues();
  const header = rows[0] || ['id', 'dormId', 'dormName', 'target', 'courier', 'cod', 'date', 'status'];
  const kept = [header];

  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][1]) !== String(dormId)) {
      kept.push(rows[r]);
    }
  }

  sheet.clear();
  if (kept.length > 0) {
    sheet.getRange(1, 1, kept.length, kept[0].length).setValues(kept);
  }

  return jsonResponse({ status: 'success' });
}

function handleSaveSettings(payload) {
  const { dormId, tplHeader, tplFooter, token } = payload || {};
  if (!dormId) {
    return jsonResponse({ status: 'error', message: 'missing dormId' });
  }

  if (!validateToken(token)) {
    return jsonResponse({ status: 'error', message: 'authentication required' });
  }

  const sheet = SS().getSheetByName('settings');
  if (!sheet) {
    appendRow('settings', [dormId, String(tplHeader || ''), String(tplFooter || '')]);
    return jsonResponse({ status: 'success' });
  }

  const rows = sheet.getDataRange().getValues();
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][0]) === String(dormId)) {
      sheet.getRange(r + 1, 2).setValue(String(tplHeader || ''));
      sheet.getRange(r + 1, 3).setValue(String(tplFooter || ''));
      return jsonResponse({ status: 'success' });
    }
  }

  appendRow('settings', [dormId, String(tplHeader || ''), String(tplFooter || '')]);
  return jsonResponse({ status: 'success' });
}

function handleAddStaff(payload) {
  const { dormId, newStaffUsername, newStaffPassword, dormName, token } = payload || {};
  if (!dormId || !newStaffUsername || !newStaffPassword) {
    return jsonResponse({ status: 'error', message: 'missing fields' });
  }

  if (!validateToken(token)) {
    return jsonResponse({ status: 'error', message: 'authentication required' });
  }

  ensureSheetsExist();
  const users = getSheetData('users');
  if (users.some(u => u[0] === newStaffUsername)) {
    return jsonResponse({ status: 'error', message: 'username exists' });
  }

  appendRow('users', [newStaffUsername, hashPassword(newStaffPassword), dormId, dormName || getDormName(dormId) || '', 'staff']);
  return jsonResponse({ status: 'success' });
}

function handleAiScanBatch(payload) {
  const base64List = Array.isArray(payload.base64List) ? payload.base64List : [];
  if (base64List.length === 0) {
    return jsonResponse({ status: 'success', result: [] });
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({
      status: 'error',
      message: 'GEMINI_API_KEY missing. Add it in Apps Script -> Project Settings -> Script Properties.'
    });
  }

  try {
    const results = [];
    const requests = base64List.map(b64 => ({
      parts: [
        {
          text: 'อ่านและสกัดข้อมูลพัสดุจากภาพนี้ แล้วตอบเป็น JSON เท่านั้น เช่น {"target":"ห้อง 105","courier":"J&T","cod":"None"} ถ้าไม่แน่ใจ ให้ {"target":"ไม่ระบุ","courier":"Other","cod":"None"}'
        },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: b64
          }
        }
      ]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${apiKey}`;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ contents: requests }),
      muteHttpExceptions: true
    });

    const text = response.getContentText();
    const json = JSON.parse(text);

    const candidates = json.candidates || [];
    for (const candidate of candidates) {
      const outputText = (candidate && candidate.content && candidate.content.parts)
        ? candidate.content.parts.map(p => p.text || '').join('\n')
        : '';

      let parsed = { target: 'ไม่ระบุ', courier: 'Other', cod: 'None' };

      try {
        const cleaned = outputText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const obj = JSON.parse(cleaned);
        parsed.target = obj.target || 'ไม่ระบุ';
        parsed.courier = obj.courier || 'Other';
        parsed.cod = obj.cod || 'None';
      } catch (e) {
        const lines = outputText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const target = lines.find(line => /ห้อง|ผู้รับ|receiver|room|name/i.test(line)) || lines[0] || 'ไม่ระบุ';
        parsed.target = target;
      }

      results.push({
        target: parsed.target,
        courier: parsed.courier,
        cod: parsed.cod,
        rawText: outputText
      });
    }

    return jsonResponse({ status: 'success', result: results });
  } catch (err) {
    console.error('Gemini error:', err);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function ensureSheetsExist() {
  const ss = SS();
  const sheetNames = ['users', 'dorms', 'settings', 'parcels', 'sessions'];

  sheetNames.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);

      if (name === 'users') {
        sheet.appendRow(['username', 'passwordHash', 'dormId', 'dormName', 'role']);
      }
      if (name === 'dorms') {
        sheet.appendRow(['dormId', 'dormName', 'createdAt']);
      }
      if (name === 'settings') {
        sheet.appendRow(['dormId', 'tplHeader', 'tplFooter']);
      }
      if (name === 'parcels') {
        sheet.appendRow(['id', 'dormId', 'dormName', 'target', 'courier', 'cod', 'date', 'status']);
      }
      if (name === 'sessions') {
        sheet.appendRow(['token', 'username', 'dormId', 'expiresAt', 'createdAt']);
      }
    }
  });
}

function getSheetData(sheetName) {
  ensureSheetsExist();
  const sheet = SS().getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  rows.shift();
  return rows;
}

function appendRow(sheetName, rowArray) {
  ensureSheetsExist();
  const sheet = SS().getSheetByName(sheetName);
  if (!sheet) throw new Error('sheet not found: ' + sheetName);
  sheet.appendRow(rowArray);
}

function getParcels(dormId) {
  const rows = getSheetData('parcels');
  return rows
    .filter(r => String(r[1]) === String(dormId))
    .map(r => ({
      id: r[0],
      dormId: r[1],
      dormName: r[2],
      target: r[3],
      courier: r[4],
      cod: r[5],
      date: r[6],
      status: r[7]
    }));
}

function getDormName(dormId) {
  const rows = getSheetData('dorms');
  const found = rows.find(r => String(r[0]) === String(dormId));
  return found ? found[1] : '';
}

function getSetting(dormId, key) {
  const sheet = SS().getSheetByName('settings');
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(dormId)) {
      if (key === 'tplHeader') return rows[i][1];
      if (key === 'tplFooter') return rows[i][2];
    }
  }
  return null;
}

function createSession(username, dormId) {
  const token = Utilities.getUuid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  appendRow('sessions', [token, username, dormId, expiresAt, now.toISOString()]);
  return token;
}

function verifySession(token) {
  const rows = getSheetData('sessions');
  const row = rows.find(r => r[0] === token);
  if (!row) return null;

  const expiresAt = new Date(row[3]);
  if (expiresAt < new Date()) return null;

  return {
    token: row[0],
    username: row[1],
    dormId: row[2],
    expiresAt: row[3]
  };
}

function validateToken(token) {
  if (!token) return false;
  return !!verifySession(token);
}

function hashPassword(str) {
  const data = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(str || ''),
    Utilities.Charset.UTF_8
  );
  return data.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function generateId() {
  return 'pkg_' + Utilities.getUuid();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function defaultHeader() {
  return '━━━━━━━━━━━━━━━\n📦 แจ้งเตือนพัสดุเข้า';
}

function defaultFooter() {
  return '━━━━━━━━━━━━━━━\n📍 จุดรับ: ออฟฟิศ';
}
