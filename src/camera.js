/**
 * Camera helpers: start/stop and capture compress image.
 * Uses canvas to resize & compress JPEG to reduce base64 payload.
 */

export async function startCamera(videoElement, opts = { facingMode: 'environment' }) {
  const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: opts.facingMode }, audio: false });
  videoElement.srcObject = s;
  await videoElement.play();
  return s;
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
}

export function captureToBase64(videoElement, maxWidth = 800, quality = 0.85) {
  const cvs = document.createElement('canvas');
  let w = videoElement.videoWidth || maxWidth;
  let h = videoElement.videoHeight || Math.round((maxWidth / w) * (videoElement.videoHeight || 600));
  if (w > maxWidth) {
    h = Math.round((maxWidth / w) * h);
    w = maxWidth;
  }
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, w, h);
  return cvs.toDataURL('image/jpeg', quality).split(',')[1];
}
