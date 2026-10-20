const GAS_ENDPOINT_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';

export function getStoredToken() {
  return localStorage.getItem('smart_parcel_token') || '';
}

export async function callGas(payload) {
  const token = getStoredToken();
  const response = await fetch(GAS_ENDPOINT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8'
    },
    body: JSON.stringify({
      ...payload,
      ...(token ? { token } : {})
    })
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid JSON response from backend');
  }
}

export async function login(username, password) {
  const result = await callGas({ action: 'login', username, password });
  if (result.status === 'success') {
    localStorage.setItem('smart_parcel_token', result.token);
    return result.user;
  }
  throw new Error(result.message || 'login failed');
}

export async function registerOwner(dormName, username, password) {
  const result = await callGas({ action: 'register_owner', dormName, username, password });
  if (result.status === 'success') {
    localStorage.setItem('smart_parcel_token', result.token);
    return result.user;
  }
  throw new Error(result.message || 'register failed');
}

export async function verifySession() {
  const token = getStoredToken();
  if (!token) return null;

  const result = await callGas({ action: 'verify_session', token });
  if (result.status === 'success') {
    return result.user;
  }

  localStorage.removeItem('smart_parcel_token');
  return null;
}

export async function fetchParcels(dormId) {
  const response = await fetch(`${GAS_ENDPOINT_URL}?dormId=${encodeURIComponent(dormId)}`);
  const json = await response.json();
  return json.data || [];
}

export async function saveParcels(dormId, items) {
  const result = await callGas({ action: 'save_parcels', dormId, items });
  if (result.status !== 'success') throw new Error(result.message || 'save failed');
  return result;
}

export async function markReceived(dormId, parcelId) {
  const result = await callGas({ action: 'mark_received', dormId, id: parcelId });
  if (result.status !== 'success') throw new Error(result.message || 'mark failed');
  return result;
}

export async function clearAllParcels(dormId) {
  const result = await callGas({ action: 'clear_all_parcels', dormId });
  if (result.status !== 'success') throw new Error(result.message || 'clear failed');
  return result;
}

export async function saveDormSettings(dormId, tplHeader, tplFooter) {
  const result = await callGas({ action: 'save_dorm_settings', dormId, tplHeader, tplFooter });
  if (result.status !== 'success') throw new Error(result.message || 'save settings failed');
  return result;
}

export async function addStaff(dormId, dormName, username, password) {
  const result = await callGas({ action: 'add_staff', dormId, dormName, newStaffUsername: username, newStaffPassword: password });
  if (result.status !== 'success') throw new Error(result.message || 'add staff failed');
  return result;
}

export async function aiScanBatch(base64List) {
  const result = await callGas({ action: 'ai_scan_batch', base64List });
  if (result.status !== 'success') throw new Error(result.message || 'AI scan failed');
  return result.result || [];
}
