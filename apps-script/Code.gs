/**
 * Simple Google Apps Script endpoints for Smart Parcel Manager
 * - doGet: used by client to fetch dorm inventory via ?dormId=...
 * - doPost: JSON body { action: "...", ... }
 *
 * NOTE: This example uses a single Spreadsheet. For production,
 * - add authentication, CSRF protections, and restrict who can call the script,
 * - consider using OAuth / Cloud Functions or own backend for stronger security.
 */

const SPREADSHEET_ID = '1or_rx4GZ9Tjg1bFPncpkTFwKtKenh3tbkhSWTEcePUE'; // <- user provided
const SS = () => SpreadsheetApp.openById(SPREADSHEET_ID);

function doGet(e) {
  const dormId = e.parameter.dormId;
  const out = { status: 'error', message: 'missing dormId', data: [] };
  if (!dormId) return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);

  try {
    const parcels = getParcels(dormId);
    out.status = 'success';
    out.data = parcels;
  } catch (err) {
    out.message = err.message;
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents || '{}');
    const action = json.action;
    if (!action) return jsonResponse({ status: 'error', message: 'no action' });

    switch (action) {
      case 'ai_scan_batch':
        // Simulate OCR results or forward to real AI service
        return jsonResponse({ status: 'success', result: simulateAiScan(json.base64List || []) });
      case 'login':
        return handleLogin(json);
      case 'register_owner':
        return handleRegister(json);
      case 'save_parcels':
        return handleSaveParcels(json);
      case 'mark_received':
        return handleMarkReceived(json);
      case 'clear_all_parcels':
        return handleClearParcels(json);
      case 'save_dorm_settings':
        return handleSaveSettings(json);
      case 'add_staff':
        return handleAddStaff(json);
      default:
        return jsonResponse({ status: 'error', message: 'unknown action' });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/* Helper handlers */

function handleLogin(payload) {
  const { username, password } = payload;
  const users = getSheetData('users');
  const row = users.find(u => u.username === username && u.password === password);
  if (!row) return jsonResponse({ status: 'error', message: 'Invalid username or password' });
  // return minimal user
  const user = {
    username: row.username,
    dormId: row.dormId,
    dormName: row.dormName,
    role: row.role || 'owner',
    tplHeader: getSetting(row.dormId, 'tplHeader'),
    tplFooter: getSetting(row.dormId, 'tplFooter')
  };
  return jsonResponse({ status: 'success', user });
}

function handleRegister(payload) {
  const { dormName, username, password } = payload;
  const dormId = 'dorm_' + Date.now().toString(36);
  // create dorm entry
  appendRow('dorms', [dormId, dormName, new Date().toISOString()]);
  // create user (owner)
  appendRow('users', [username, password, dormId, dormName, 'owner']);
  return jsonResponse({ status: 'success', user: { username, dormId, dormName, role: 'owner' }});
}

function handleSaveParcels(payload) {
  const { dormId, items } = payload;
  if (!Array.isArray(items)) return jsonResponse({ status: 'error', message: 'items must be array' });
  items.forEach(item => {
    appendRow('parcels', [item.id, dormId, item.dormName, item.target, item.courier, item.cod, item.date, item.status || 'pending']);
  });
  return jsonResponse({ status: 'success' });
}

function handleMarkReceived(payload) {
  const { dormId, id } = payload;
  // find parcel row and mark status
  const sheet = SS().getSheetByName('parcels');
  if (!sheet) return jsonResponse({ status: 'error', message: 'no parcels sheet' });
  const data = sheet.getDataRange().getValues();
  for (let r=1;r<data.length;r++){
    if (data[r][0] === id && data[r][1] === dormId) {
      sheet.getRange(r+1, 8).setValue('received'); // status column (8th)
      return jsonResponse({ status: 'success' });
    }
  }
  return jsonResponse({ status: 'error', message: 'not found' });
}

function handleClearParcels(payload) {
  const { dormId } = payload;
  const sheet = SS().getSheetByName('parcels');
  if (!sheet) return jsonResponse({ status: 'error', message: 'no parcels sheet' });
  const data = sheet.getDataRange().getValues();
  // rebuild rows excluding dormId
  const header = data[0];
  const kept = [header];
  for (let r=1;r<data.length;r++){
    if (data[r][1] !== dormId) kept.push(data[r]);
  }
  sheet.clear();
  sheet.getRange(1,1,kept.length, kept[0].length).setValues(kept);
  return jsonResponse({ status: 'success' });
}

function handleSaveSettings(payload) {
  const { dormId, tplHeader, tplFooter } = payload;
  // upsert settings in 'settings' sheet: columns [dormId, tplHeader, tplFooter]
  const sheet = SS().getSheetByName('settings');
  if (!sheet) return jsonResponse({ status: 'error', message: 'no settings sheet' });
  const data = sheet.getDataRange().getValues();
  for (let r=1;r<data.length;r++){
    if (data[r][0] === dormId) {
      sheet.getRange(r+1,2).setValue(tplHeader);
      sheet.getRange(r+1,3).setValue(tplFooter);
      return jsonResponse({ status: 'success' });
    }
  }
  sheet.appendRow([dormId, tplHeader, tplFooter]);
  return jsonResponse({ status: 'success' });
}

function handleAddStaff(payload) {
  const { dormId, newStaffUsername, newStaffPassword, dormName } = payload;
  appendRow('users', [newStaffUsername, newStaffPassword, dormId, dormName, 'staff']);
  return jsonResponse({ status: 'success' });
}

/* Utilities for spreadsheet */

function getParcels(dormId) {
  const rows = getSheetData('parcels'); // columns: id,dormId,dormName,target,courier,cod,date,status
  const res = rows.map(r => ({
    id: r[0], dormId: r[1], dormName: r[2], target: r[3], courier: r[4], cod: r[5], date: r[6], status: r[7]
  })).filter(r => r.dormId === dormId);
  return res;
}

function getSheetData(sheetName) {
  const sheet = SS().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  data.shift(); // remove header
  return data;
}

function appendRow(sheetName, rowArray) {
  let sheet = SS().getSheetByName(sheetName);
  if (!sheet) {
    sheet = SS().insertSheet(sheetName);
    // create minimal header based on sheet
    if (sheetName === 'parcels') sheet.appendRow(['id','dormId','dormName','target','courier','cod','date','status']);
    if (sheetName === 'users') sheet.appendRow(['username','password','dormId','dormName','role']);
    if (sheetName === 'dorms') sheet.appendRow(['dormId','dormName','createdAt']);
    if (sheetName === 'settings') sheet.appendRow(['dormId','tplHeader','tplFooter']);
  }
  sheet.appendRow(rowArray);
}

function getSetting(dormId, key) {
  const sheet = SS().getSheetByName('settings');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let r=1;r<data.length;r++){
    if (data[r][0] === dormId) return { tplHeader: data[r][1], tplFooter: data[r][2] }[key];
  }
  return null;
}

/* Helpers */

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function simulateAiScan(base64List) {
  // For demo: return array of objects { target, courier, cod }
  return base64List.map((_,i) => ({ target: `Demo${i+1}`, courier: 'Other', cod: 'None' }));
}
