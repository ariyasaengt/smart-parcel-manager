import { postAction, fetchDorm } from './api.js';
import { startCamera, stopCamera, captureToBase64 } from './camera.js';
import { toast, confirmModal } from './ui.js';
import { generateId, isSamePerson } from './utils.js';

// This file will wire up the existing DOM from index.html but using module functions.
// For the initial PR we'll keep behavior identical but with safer API calls and toasts.

window.app = {
  async callGas(payload) {
    try {
      const res = await postAction(payload.action, payload);
      if (!res) throw new Error('No response');
      return res;
    } catch (e) {
      toast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', { type: 'error' });
      throw e;
    }
  }
};

// Example: expose for debugging
export default window.app;
