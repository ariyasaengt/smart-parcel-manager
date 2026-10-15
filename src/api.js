// API wrapper for Google Apps Script backend.
// Exposes: postAction(action, payload) and fetchDorm(dormId)

const GAS_ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbwphltYrBk_o_CCQOiWjO8_syGyfF8sqsJ5APtSDvOHC5kjT3VUfi0zka3GuV-WRDp0ew/exec";

function timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
}

export async function postAction(action, payload = {}, opts = {}) {
  const url = GAS_ENDPOINT_URL;
  const body = JSON.stringify(Object.assign({ action }, payload));
  const controller = new AbortController();
  const timeoutMs = opts.timeout || 15000;

  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body,
    signal: controller.signal
  }).then(async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON from backend');
    }
  });

  const race = Promise.race([fetchPromise, timeout(timeoutMs)]);
  try {
    return await race;
  } catch (err) {
    controller.abort();
    throw err;
  }
}

export async function fetchDorm(dormId) {
  const url = `${GAS_ENDPOINT_URL}?dormId=${encodeURIComponent(dormId)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Network response was not ok');
  return await res.json();
}
