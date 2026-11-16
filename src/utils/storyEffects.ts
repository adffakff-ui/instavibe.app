import { DrawStroke, StoryMention, StoryPartnership, StorySticker, StoryTextOverlay } from '../types/story';

export interface StoryFilterPreset {
  id: string;
  name: string;
  nameAr: string;
  css: string;
  swatch: string;
}

export const STORY_FILTER_PRESETS: StoryFilterPreset[] = [
  { id: 'none', name: 'Normal', nameAr: 'عادي', css: '', swatch: 'from-slate-600 to-slate-800' },
  { id: 'bw', name: 'Monochrome', nameAr: 'أبيض وأسود', css: 'grayscale(100%) contrast(115%)', swatch: 'from-zinc-400 to-zinc-900' },
  { id: 'bright', name: 'Brighten', nameAr: 'ساطع', css: 'brightness(120%) contrast(105%)', swatch: 'from-amber-200 to-yellow-500' },
  { id: 'warm', name: 'Warm Sunset', nameAr: 'دافئ', css: 'sepia(25%) saturate(135%) brightness(105%)', swatch: 'from-orange-400 to-rose-600' },
  { id: 'cinematic', name: 'Cinematic', nameAr: 'سينمائي', css: 'contrast(125%) saturate(120%)', swatch: 'from-indigo-500 to-slate-900' },
  { id: 'vintage', name: 'Vintage', nameAr: 'كلاسيكي', css: 'sepia(45%) contrast(110%) brightness(95%)', swatch: 'from-amber-700 to-stone-800' },
  { id: 'vibrant', name: 'Vibrant Pop', nameAr: 'ألوان حيوية', css: 'saturate(165%) contrast(110%)', swatch: 'from-pink-500 to-purple-600' },
  { id: 'cool', name: 'Cool Mist', nameAr: 'ضباب بارد', css: 'hue-rotate(18deg) saturate(110%) brightness(104%)', swatch: 'from-cyan-400 to-blue-700' },
  { id: 'neon', name: 'Neon Night', nameAr: 'نيون ليلي', css: 'contrast(135%) saturate(180%) brightness(95%)', swatch: 'from-fuchsia-500 to-cyan-500' },
];

export function getFilterCssById(filterId?: string): string {
  if (!filterId || filterId === 'none') return 'none';
  const preset = STORY_FILTER_PRESETS.find((p) => p.id === filterId);
  return preset?.css || 'none';
}

export function renderStrokesToCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: DrawStroke[],
  width: number,
  height: number
) {
  const scaleFactor = width / 360;
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.width * scaleFactor;

    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      if (stroke.isGlow) {
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = 14 * scaleFactor;
      }
    }

    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x * width, first.y * height);
    if (stroke.points.length === 1) {
      ctx.lineTo(first.x * width + 0.1, first.y * height + 0.1);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Bake image + CSS filter + optional freehand strokes into a 1080x1920 JPEG data URL for Firestore upload.
 */
export async function composeStoryMediaForPublish(params: {
  sourceUrl: string;
  filterCss: string;
  strokes: DrawStroke[];
}): Promise<string> {
  const { sourceUrl, filterCss, strokes } = params;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const MAX_WIDTH = 1080;
      const MAX_HEIGHT = 1920;
      let { width, height } = img;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      if (filterCss && filterCss !== 'none') {
        ctx.save();
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, width, height);
      }

      if (strokes.length > 0) {
        // Draw strokes on an offscreen layer so eraser strokes only erase brush strokes, not the photo
        const drawCanvas = document.createElement('canvas');
        drawCanvas.width = width;
        drawCanvas.height = height;
        const drawCtx = drawCanvas.getContext('2d');
        if (drawCtx) {
          renderStrokesToCanvas(drawCtx, strokes, width, height);
          ctx.drawImage(drawCanvas, 0, 0);
        }
      }

      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Failed to load image for processing'));
    img.src = sourceUrl;
  });
}

/**
 * Export full 1080x1920 Story image including filters, drawing, text overlays, stickers, mentions, partnership, and caption.
 */
export async function exportFullStoryImage(params: {
  sourceUrl: string;
  filterCss: string;
  strokes: DrawStroke[];
  textOverlays: StoryTextOverlay[];
  stickers: StorySticker[];
  mentions: StoryMention[];
  partnership?: StoryPartnership | null;
  caption?: string;
}): Promise<string> {
  const { sourceUrl, filterCss, strokes, textOverlays, stickers, mentions, partnership, caption } = params;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      // Cover crop math
      const imgAspect = img.width / img.height;
      const canvasAspect = W / H;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }

      ctx.save();
      if (filterCss && filterCss !== 'none') {
        ctx.filter = filterCss;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      ctx.restore();

      // Freehand strokes
      if (strokes.length > 0) {
        const drawCanvas = document.createElement('canvas');
        drawCanvas.width = W;
        drawCanvas.height = H;
        const drawCtx = drawCanvas.getContext('2d');
        if (drawCtx) {
          renderStrokesToCanvas(drawCtx, strokes, W, H);
          ctx.drawImage(drawCanvas, 0, 0);
        }
      }

      // Text Overlays
      for (const item of textOverlays) {
        const cx = (item.x / 100) * W;
        const cy = (item.y / 100) * H;
        const fontSize = Math.round(54 * (item.scale || 1));
        const fontFamily =
          item.fontStyle === 'typewriter'
            ? 'monospace'
            : item.fontStyle === 'classic'
            ? 'Georgia, serif'
            : 'system-ui, -apple-system, sans-serif';
        const weight = item.fontStyle === 'bold' || item.fontStyle === 'neon' ? '900' : '700';

        ctx.save();
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = item.text.split('\n');
        const lineHeight = fontSize * 1.28;
        const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 60);
        const boxW = maxLineWidth + 56;
        const boxH = lines.length * lineHeight + 28;

        if (item.bgStyle === 'solid' || item.bgStyle === 'translucent') {
          ctx.fillStyle =
            item.bgStyle === 'solid'
              ? item.color === '#ffffff'
                ? '#0f172a'
                : item.color
              : 'rgba(0,0,0,0.62)';
          ctx.beginPath();
          ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 24);
          ctx.fill();
        }

        if (item.fontStyle === 'neon') {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 22;
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = 8;
        }

        ctx.fillStyle =
          item.bgStyle === 'solid' && item.color !== '#ffffff' ? '#ffffff' : item.color;

        lines.forEach((line, idx) => {
          const offsetY = cy + (idx - (lines.length - 1) / 2) * lineHeight;
          if (item.bgStyle === 'outline') {
            ctx.lineWidth = 8;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.strokeText(line, cx, offsetY);
          }
          ctx.fillText(line, cx, offsetY);
        });
        ctx.restore();
      }

      // Stickers
      for (const sticker of stickers) {
        const cx = (sticker.x / 100) * W;
        const cy = (sticker.y / 100) * H;
        ctx.save();
        if (sticker.type === 'emoji') {
          ctx.font = '120px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sticker.value, cx, cy);
        } else {
          const label =
            sticker.type === 'location'
              ? `📍 ${sticker.value}`
              : sticker.type === 'time'
              ? `🕒 ${sticker.value}`
              : `✨ ${sticker.value}`;
          ctx.font = '700 34px system-ui, sans-serif';
          const tw = ctx.measureText(label).width;
          const bw = tw + 56;
          const bh = 68;
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 22);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, cx, cy);
        }
        ctx.restore();
      }

      // Mentions
      for (const mention of mentions) {
        const cx = (mention.x / 100) * W;
        const cy = (mention.y / 100) * H;
        const label = `@${mention.username}`;
        ctx.save();
        ctx.font = '800 36px system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const bw = tw + 56;
        const bh = 68;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 34);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
        ctx.restore();
      }

      // Partnership badge
      if (partnership && (partnership.isPaid || partnership.partnerUsername)) {
        const label = partnership.partnerUsername
          ? `شراكة مع @${partnership.partnerUsername}`
          : 'شراكة مدفوعة';
        ctx.save();
        ctx.font = '700 28px system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const bw = tw + 44;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - bw / 2, 72, bw, 52, 26);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, W / 2, 98);
        ctx.restore();
      }

      // Caption at bottom
      if (caption && caption.trim()) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, H - 180, W, 110);
        ctx.font = '600 34px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(caption.trim().slice(0, 80), W / 2, H - 125);
        ctx.restore();
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Failed to export story image'));
    img.src = sourceUrl;
  });
}
