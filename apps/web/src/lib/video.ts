/**
 * Generate a JPEG thumbnail from a video source entirely in the browser
 * (HTMLVideoElement + canvas). Falls back to `null` when the video cannot be
 * decoded (so the UI can degrade gracefully).
 *
 * The generator is deliberately defensive: it tries several seek timestamps
 * and, if the browser never fires the `seeked` event (common on some mobile
 * Safari/iOS), it draws the currently available frame on `loadeddata`/`seeked`
 * from a scheduled timer. This keeps automatic thumbnail generation working
 * where seeking is unreliable.
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

    // Hard timeout so we never hang the upload flow on a stuck video element.
    const timeout = window.setTimeout(fail, 20000);

    const draw = () => {
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

    video.onerror = () => {
      clearTimeout(timeout);
      fail();
    };

    // Frames to attempt, in order. Tries a slightly-in frame first (some videos
    // are black at 0s), falling back toward the start.
    const seekTimes = [0.1, 0.5, 1, 0].filter((t) => Number.isFinite(t));

    const trySeek = (pending: number[]) => {
      const target = pending.shift();
      if (target === undefined) return; // nothing more to try
      try {
        video.currentTime = Math.max(0, Math.min(video.duration || 0, target));
      } catch {
        return draw();
      }
      video.onseeked = () => {
        clearTimeout(timeout);
        try {
          video.onseeked = null;
          trySeek(pending);
        } catch {
          fail();
        }
      };
      // Guard: if `seeked` never fires for this position, move on, and if
      // nothing remains draw whatever frame is currently available.
      window.setTimeout(() => {
        if (settled || !video.onseeked) return;
        video.onseeked = null;
        if (pending.length > 0) trySeek(pending);
        else draw();
      }, 1500);
    };

    // Start as soon as we have enough frame data / metadata.
    const start = () => {
      clearTimeout(timeout);
      video.onseeked = null;
      trySeek(seekTimes.slice());
    };
    if (video.readyState >= 2) {
      start();
    } else {
      const onBuyer = () => {
        video.removeEventListener('loadeddata', onBuyer);
        video.removeEventListener('loadedmetadata', onBuyer);
        start();
      };
      video.addEventListener('loadeddata', onBuyer);
      video.addEventListener('loadedmetadata', onBuyer);
    }
  });
}