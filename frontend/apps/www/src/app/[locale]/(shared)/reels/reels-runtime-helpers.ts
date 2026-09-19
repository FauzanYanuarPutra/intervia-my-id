import { getUserMediaErrorName } from '@/lib/mediaDevices';
import type { ReelsStudioEffect } from './reels-studio-helpers';

type VideoFramePumpElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function startVideoFramePump(
  video: HTMLVideoElement,
  fps: number,
  paintFrame: () => void,
): () => void {
  const targetFrameDuration = 1000 / Math.max(1, fps);
  const frameVideo = video as VideoFramePumpElement;

  if (frameVideo.requestVideoFrameCallback) {
    let stopped = false;
    let frameHandle = 0;
    let lastPaintedAt = 0;
    const tick = (now: number) => {
      if (stopped) return;
      if (now - lastPaintedAt >= targetFrameDuration - 2) {
        lastPaintedAt = now;
        paintFrame();
      }
      frameHandle = frameVideo.requestVideoFrameCallback!(tick);
    };
    frameHandle = frameVideo.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      frameVideo.cancelVideoFrameCallback?.(frameHandle);
    };
  }

  const interval = window.setInterval(
    paintFrame,
    Math.max(Math.round(targetFrameDuration), 20),
  );
  return () => window.clearInterval(interval);
}

export function getReelsCameraErrorMessage(error: unknown, locale: string): string {
  const isId = locale === 'id';
  const name = getUserMediaErrorName(error);

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return isId
      ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.'
      : 'Camera permission was denied. Allow it in browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return isId
      ? 'Kamera tidak ditemukan di perangkat ini. Kamu masih bisa pilih video dari galeri.'
      : 'No camera was found. You can still choose a video from the gallery.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return isId
      ? 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
      : 'The camera is being used by another app. Close it and try again.';
  }
  return isId
    ? 'Kamera belum bisa dibuka. Coba lagi atau pilih video dari galeri.'
    : 'The camera could not be opened. Try again or choose a gallery video.';
}

export function drawVideoCoverFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const targetRatio = width / height;
  const sourceRatio = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
}

export function drawStudioCanvasEffect(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: ReelsStudioEffect,
) {
  if (effect === 'none') return;

  context.save();
  if (effect === 'clean') {
    const glow = context.createRadialGradient(
      width * 0.5,
      height * 0.18,
      0,
      width * 0.5,
      height * 0.18,
      width * 0.78,
    );
    glow.addColorStop(0, 'rgba(255,255,255,0.22)');
    glow.addColorStop(0.55, 'rgba(16,185,129,0.08)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
  } else if (effect === 'product') {
    const warmth = context.createLinearGradient(0, 0, width, height);
    warmth.addColorStop(0, 'rgba(250,204,21,0.16)');
    warmth.addColorStop(0.52, 'rgba(255,255,255,0.03)');
    warmth.addColorStop(1, 'rgba(244,63,94,0.12)');
    context.fillStyle = warmth;
    context.fillRect(0, 0, width, height);
  } else if (effect === 'focus') {
    const vignette = context.createRadialGradient(
      width / 2,
      height * 0.47,
      width * 0.16,
      width / 2,
      height * 0.5,
      width * 0.76,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.62, 'rgba(0,0,0,0.08)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  } else if (effect === 'scan') {
    context.fillStyle = 'rgba(6,182,212,0.12)';
    for (let y = 0; y < height; y += 18) {
      context.fillRect(0, y, width, 2);
    }
  } else if (effect === 'dog') {
    context.fillStyle = 'rgba(120,53,15,0.92)';
    context.beginPath();
    context.ellipse(
      width * 0.3,
      height * 0.14,
      width * 0.09,
      height * 0.055,
      -0.62,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      width * 0.7,
      height * 0.14,
      width * 0.09,
      height * 0.055,
      0.62,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = 'rgba(254,243,199,0.96)';
    context.beginPath();
    context.ellipse(
      width * 0.3,
      height * 0.145,
      width * 0.044,
      height * 0.026,
      -0.62,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      width * 0.7,
      height * 0.145,
      width * 0.044,
      height * 0.026,
      0.62,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = 'rgba(17,24,39,0.92)';
    context.beginPath();
    context.ellipse(
      width * 0.5,
      height * 0.41,
      width * 0.045,
      height * 0.026,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.strokeStyle = 'rgba(17,24,39,0.6)';
    context.lineWidth = Math.max(2, width * 0.004);
    [-1, 1].forEach(side => {
      for (let offset = -1; offset <= 1; offset += 1) {
        context.beginPath();
        context.moveTo(
          width * 0.5 + side * width * 0.052,
          height * (0.425 + offset * 0.01),
        );
        context.lineTo(
          width * 0.5 + side * width * 0.17,
          height * (0.41 + offset * 0.026),
        );
        context.stroke();
      }
    });
    context.fillStyle = 'rgba(244,63,94,0.82)';
    context.beginPath();
    context.roundRect(
      width * 0.474,
      height * 0.443,
      width * 0.052,
      height * 0.05,
      width * 0.026,
    );
    context.fill();
  } else if (effect === 'grain') {
    context.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 280; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      context.fillRect(x, y, 1.2, 1.2);
    }
  }
  context.restore();
}

