/**
 * Generate a JPEG thumbnail from a video source entirely in the browser
 * (HTMLVideoElement + canvas). Falls back to `null` when the video cannot be
 * decoded (so the UI can degrade gracefully).
 */
export function extractVideoThumbnail(src: string | Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url =
      typeof src === 'string' ? src : URL.createObjectURL(src);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    let settled = false;
    const cleanup = () => {
      if (typeof src !== 'string' && url) URL.revokeObjectURL(url);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };
    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    const timer = window.setTimeout(fail, 20000);

    video.onerror = () => {
      clearTimeout(timer);
      fail();
    };

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      try {
        const target = Math.min(1, video.duration || 1);
        if (video.currentTime !== target) video.currentTime = target;
      } catch {
        fail();
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = 640;
        const height = video.videoHeight
          ? Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width))
          : 360;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return fail();
        ctx.drawImage(video, 0, 0, width, height);
        canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.85);
      } catch {
        fail();
      }
    };
  });
}
