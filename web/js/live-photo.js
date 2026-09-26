// Photos stay behind the room's existing Bearer permission checks.
export function createPhotoStore(getToken, signal) {
  const urls = new Map();
  const pending = new Map();
  let generation = 0;
  function clear() {
    generation += 1;
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.clear();
    pending.clear();
  }
  async function load(id) {
    if (urls.has(id)) return urls.get(id);
    if (pending.has(id)) return pending.get(id);
    const current = generation;
    const token = getToken();
    const work = (async () => {
      const response = await fetch(`/api/live/photos/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
      });
      if (!response.ok) throw new Error('这张照片暂时无法读取。请刷新房间后重试。');
      const blob = await response.blob();
      if (signal.aborted || current !== generation || token !== getToken()) throw new DOMException('Photo session changed', 'AbortError');
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      return url;
    })();
    pending.set(id, work);
    try { return await work; }
    finally { if (pending.get(id) === work) pending.delete(id); }
  }
  return { load, peek: id => urls.get(id), clear };
}

/** Redraw a phone image, discarding EXIF and limiting the actual JPEG bytes. */
export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 照片。iPhone 的 HEIC 照片请先转为 JPG。');
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const picture = new Image();
      picture.onload = () => resolve(picture);
      picture.onerror = () => reject(new Error('这张照片没能打开，请重新选择一张。'));
      picture.src = source;
    });
    const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f2efe7';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.82, .72, .62, .5, .38]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('照片处理失败，请重新选择。');
      if (blob.size <= 300 * 1024) return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('照片读取失败，请重新选择。'));
        reader.readAsDataURL(blob);
      });
    }
    throw new Error('这张照片细节太多，请裁剪后重新选择。照片需压缩至 300 KB 内。');
  } finally { URL.revokeObjectURL(source); }
}
