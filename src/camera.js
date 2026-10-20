export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
}

export function captureImageToBase64(videoEl) {
  const canvas = document.getElementById('captureCanvas');
  const width = videoEl.videoWidth || 800;
  const height = videoEl.videoHeight || 600;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}
