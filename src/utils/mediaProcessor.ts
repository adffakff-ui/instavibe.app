export interface ProcessedMediaResult {
  dataUrl: string;
  mediaType: 'image' | 'video';
  width: number;
  height: number;
  durationSeconds?: number;
  originalSizeBytes: number;
  finalSizeBytes: number;
  compressed: boolean;
}

const MAX_FIRESTORE_DATA_URL_LENGTH = 885_000;
const DIRECT_VIDEO_BYTE_LIMIT = 650 * 1024;
const MAX_INPUT_VIDEO_BYTES = 35 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 12;

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read media file'));
    reader.readAsDataURL(file);
  });
}

function approximateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64Len = commaIdx >= 0 ? dataUrl.length - commaIdx - 1 : dataUrl.length;
  return Math.round((base64Len * 3) / 4);
}

export async function processGalleryImageFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<ProcessedMediaResult> {
  onProgress?.(15);
  const rawUrl = await readFileAsDataUrl(file);
  onProgress?.(40);

  return new Promise<ProcessedMediaResult>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let maxDimension = 1280;
        let quality = 0.84;

        const encodeAt = (maxDim: number, q: number): { url: string; w: number; h: number } => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context unavailable');
          }
          ctx.drawImage(img, 0, 0, width, height);
          return {
            url: canvas.toDataURL('image/jpeg', q),
            w: width,
            h: height,
          };
        };

        let result = encodeAt(maxDimension, quality);
        onProgress?.(70);

        // Iteratively step down quality / dimensions if the photo still exceeds Firestore packet limits
        const attempts: Array<[number, number]> = [
          [1280, 0.72],
          [1080, 0.68],
          [960, 0.6],
          [720, 0.55],
        ];
        for (const [dim, q] of attempts) {
          if (result.url.length <= MAX_FIRESTORE_DATA_URL_LENGTH) break;
          result = encodeAt(dim, q);
        }

        if (result.url.length > MAX_FIRESTORE_DATA_URL_LENGTH) {
          reject(new Error('Image exceeds maximum upload size even after compression.'));
          return;
        }

        onProgress?.(100);
        resolve({
          dataUrl: result.url,
          mediaType: 'image',
          width: result.w,
          height: result.h,
          originalSizeBytes: file.size,
          finalSizeBytes: approximateDataUrlBytes(result.url),
          compressed: result.url !== rawUrl,
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not decode selected image file.'));
    img.src = rawUrl;
  });
}

function getSupportedRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export async function processGalleryVideoFile(
  file: File,
  options?: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
    language?: 'ar' | 'en';
  }
): Promise<ProcessedMediaResult> {
  const { onProgress, signal, language = 'ar' } = options || {};
  onProgress?.(10);

  if (file.size > MAX_INPUT_VIDEO_BYTES) {
    throw new Error(
      language === 'ar'
        ? 'حجم الفيديو كبير جداً (أكثر من 35 ميجابايت). يرجى اختيار مقطع أقصر أو لصق رابط الفيديو.'
        : 'Video file is too large (over 35 MB). Please select a shorter clip or paste a direct video URL.'
    );
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onerror = null;
      };
      video.onloadedmetadata = () => {
        cleanup();
        resolve();
      };
      video.onerror = () => {
        cleanup();
        reject(
          new Error(
            language === 'ar'
              ? 'تعذر قراءة ملف الفيديو المختار.'
              : 'Could not read the selected video file.'
          )
        );
      };
    });

    const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0;
    const rawWidth = video.videoWidth || 480;
    const rawHeight = video.videoHeight || 854;

    // Fast path for small clips that already fit inside Firestore safely
    if (file.size <= DIRECT_VIDEO_BYTE_LIMIT) {
      onProgress?.(60);
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length <= MAX_FIRESTORE_DATA_URL_LENGTH) {
        onProgress?.(100);
        return {
          dataUrl,
          mediaType: 'video',
          width: rawWidth,
          height: rawHeight,
          durationSeconds,
          originalSizeBytes: file.size,
          finalSizeBytes: file.size,
          compressed: false,
        };
      }
    }

    // Client-side Canvas + MediaRecorder compression for larger gallery videos
    const mimeType = getSupportedRecorderMimeType();
    if (!mimeType || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
      throw new Error(
        language === 'ar'
          ? 'حجم الفيديو يتجاوز 650 كيلوبايت والمتصفح لا يدعم الضغط التلقائي. اختر مقطعاً أقصر أو الصق رابطاً مباشراً.'
          : 'Video exceeds 650 KB and automatic browser compression is unavailable. Please choose a shorter clip or paste a direct URL.'
      );
    }

    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(rawWidth, rawHeight));
    const targetWidth = Math.max(2, Math.round((rawWidth * scale) / 2) * 2);
    const targetHeight = Math.max(2, Math.round((rawHeight * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    const effectiveDuration = Math.min(
      durationSeconds > 0 ? durationSeconds : MAX_VIDEO_DURATION_SECONDS,
      MAX_VIDEO_DURATION_SECONDS
    );
    // Keep target bitrate bounded so Base64 stays comfortably below 885 KB
    const targetBytes = 580 * 1024;
    const computedBps = Math.min(420_000, Math.max(160_000, Math.floor((targetBytes * 8) / Math.max(effectiveDuration, 2))));

    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: computedBps,
    });

    const chunks: BlobPart[] = [];
    let totalRecordedBytes = 0;

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      let rafId = 0;
      let stopped = false;

      const finishRecording = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(rafId);
        try {
          video.pause();
        } catch {
          // ignore
        }
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      const onAbort = () => {
        finishRecording();
        reject(new Error(language === 'ar' ? 'تم إلغاء معالجة الفيديو.' : 'Video processing cancelled.'));
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
          totalRecordedBytes += ev.data.size;
          if (totalRecordedBytes >= 600 * 1024) {
            finishRecording();
          }
        }
      };

      recorder.onerror = () => {
        cancelAnimationFrame(rafId);
        signal?.removeEventListener('abort', onAbort);
        reject(
          new Error(
            language === 'ar'
              ? 'فشلت عملية ضغط الفيديو. يرجى اختيار مقطع أصغر أو لصق رابط الفيديو.'
              : 'Video compression failed. Please pick a shorter clip or paste a URL.'
          )
        );
      };

      recorder.onstop = () => {
        signal?.removeEventListener('abort', onAbort);
        stream.getTracks().forEach((t) => t.stop());
        if (signal?.aborted) return;
        resolve(new Blob(chunks, { type: mimeType.split(';')[0] }));
      };

      const drawLoop = () => {
        if (stopped) return;
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        if (effectiveDuration > 0) {
          const pct = Math.min(92, Math.round(15 + (video.currentTime / effectiveDuration) * 77));
          onProgress?.(pct);
        }
        if (video.currentTime >= MAX_VIDEO_DURATION_SECONDS || video.ended) {
          finishRecording();
          return;
        }
        rafId = requestAnimationFrame(drawLoop);
      };

      video.onended = () => finishRecording();
      video.currentTime = 0;
      recorder.start(300);
      video
        .play()
        .then(() => {
          rafId = requestAnimationFrame(drawLoop);
        })
        .catch(() => {
          finishRecording();
          reject(
            new Error(
              language === 'ar'
                ? 'تعذر تشغيل الفيديو لضغطه داخل المتصفح.'
                : 'Could not play video for compression.'
            )
          );
        });
    });

    const dataUrl = await readFileAsDataUrl(compressedBlob);
    if (dataUrl.length > MAX_FIRESTORE_DATA_URL_LENGTH) {
      throw new Error(
        language === 'ar'
          ? 'ما زال حجم الفيديو بعد الضغط أكبر من الحد المسموح. يرجى اختيار مقطع أقصر (3-8 ثوانٍ) أو لصق رابط مباشر.'
          : 'Compressed video is still larger than the storage limit. Please use a shorter clip (3-8s) or a direct URL.'
      );
    }

    onProgress?.(100);
    return {
      dataUrl,
      mediaType: 'video',
      width: targetWidth,
      height: targetHeight,
      durationSeconds: Math.min(durationSeconds || effectiveDuration, MAX_VIDEO_DURATION_SECONDS),
      originalSizeBytes: file.size,
      finalSizeBytes: compressedBlob.size,
      compressed: true,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
