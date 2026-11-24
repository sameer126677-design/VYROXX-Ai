import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ScanLine, Undo2, Trash2, Download, Play, Pause, Plus, RotateCcw } from 'lucide-react';
import { AssetRecord } from '../types';
import { fetchAuthenticatedAssetBlobUrl } from '../lib/apiClient';

type PartKind = 'head' | 'torso' | 'left-arm' | 'right-arm' | 'left-leg' | 'right-leg' | 'other';
type Point = { x: number; y: number };
type RigPart = {
  id: string;
  kind: PartKind;
  polygon: Point[];
  pivot: Point;
  png: string;
};

const PART_OPTIONS: { value: PartKind; label: string }[] = [
  { value: 'head', label: 'Head' },
  { value: 'torso', label: 'Torso' },
  { value: 'left-arm', label: 'Left arm' },
  { value: 'right-arm', label: 'Right arm' },
  { value: 'left-leg', label: 'Left leg' },
  { value: 'right-leg', label: 'Right leg' },
  { value: 'other', label: 'Other part' },
];

interface CharacterRigStudioProps {
  asset: AssetRecord;
  onClose: () => void;
}

export const CharacterRigStudio: React.FC<CharacterRigStudioProps> = ({ asset, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const partImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [kind, setKind] = useState<PartKind>('head');
  const [points, setPoints] = useState<Point[]>([]);
  const [pivot, setPivot] = useState<Point | null>(null);
  const [settingPivot, setSettingPivot] = useState(false);
  const [parts, setParts] = useState<RigPart[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setLoading(true);
    fetchAuthenticatedAssetBlobUrl(asset.storagePath)
      .then((url) => {
        objectUrl = url;
        if (active) setImageUrl(url);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load this image.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.storagePath]);

  useEffect(() => {
    if (!imageUrl) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => setError('This asset could not be decoded as an image.');
    image.src = imageUrl;
  }, [imageUrl]);

  const drawEditor = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageSize.width) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    if (points.length) {
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.fillStyle = 'rgba(34,211,238,0.16)';
      ctx.lineWidth = Math.max(2, imageSize.width / 500);
      ctx.beginPath();
      points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
      if (points.length > 2) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
      points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(4, imageSize.width / 160), 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
      });
      ctx.restore();
    }
    if (pivot) {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = Math.max(2, imageSize.width / 500);
      ctx.beginPath();
      ctx.arc(pivot.x, pivot.y, Math.max(7, imageSize.width / 110), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [imageSize, points, pivot]);

  useEffect(() => { drawEditor(); }, [drawEditor]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    if (settingPivot) {
      setPivot({ x, y });
      setSettingPivot(false);
    } else {
      setPoints((current) => [...current, { x, y }]);
    }
  };

  const savePart = () => {
    const image = imageRef.current;
    if (!image || points.length < 3) {
      setError('Add at least 3 polygon points around the body part.');
      return;
    }
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));
    const layer = document.createElement('canvas');
    layer.width = image.naturalWidth;
    layer.height = image.naturalHeight;
    const ctx = layer.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.beginPath();
    points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, 0, 0);
    ctx.restore();
    const center = pivot || { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const next: RigPart = {
      id: `${kind}-${Date.now()}`,
      kind,
      polygon: points,
      pivot: center,
      png: layer.toDataURL('image/png'),
    };
    setParts((current) => [...current.filter((part) => part.kind !== kind), next]);
    setPoints([]);
    setPivot(null);
    setError('');
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const downloadRig = () => {
    if (!parts.length) return;
    const manifest = {
      format: 'vyroxx-character-rig',
      version: 1,
      source: asset.name,
      sourceSize: imageSize,
      coordinateSpace: 'source-image-pixels',
      parts: parts.map(({ id, kind: partKind, polygon, pivot }) => ({
        id, kind: partKind, polygon, pivot, file: `${partKind}.png`,
      })),
      notes: 'Each PNG is a transparent full-canvas cutout. Parts are manually polygon-masked; pivot is the rotation joint.',
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vyroxx-character-rig.json';
    link.click();
    URL.revokeObjectURL(url);
    parts.forEach((part) => downloadDataUrl(part.png, `${part.kind}.png`));
  };

  useEffect(() => {
    const cache = new Map<string, HTMLImageElement>();
    parts.forEach((part) => {
      const layer = new Image();
      layer.onload = () => {
        partImagesRef.current = new Map(cache);
        const canvas = previewRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && !previewing) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          parts.forEach((item) => {
            const loaded = partImagesRef.current.get(item.id);
            if (loaded?.complete && loaded.naturalWidth) ctx.drawImage(loaded, 0, 0);
          });
        }
      };
      layer.src = part.png;
      cache.set(part.id, layer);
    });
    partImagesRef.current = cache;
  }, [parts, previewing]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !imageSize.width || !imageSize.height) return;
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((part, index) => {
        const layer = partImagesRef.current.get(part.id);
        if (!layer?.complete || !layer.naturalWidth) return;
        const angle = previewing
          ? Math.sin(time / 240 + index * 0.8) * (part.kind.includes('arm') ? 0.16 : part.kind.includes('leg') ? 0.12 : 0.035)
          : 0;
        ctx.save();
        ctx.translate(part.pivot.x, part.pivot.y);
        ctx.rotate(angle);
        ctx.drawImage(layer, -part.pivot.x, -part.pivot.y);
        ctx.restore();
      });
      if (previewing) raf = requestAnimationFrame(draw);
    };
    draw(0);
    if (previewing) raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [parts, previewing, imageSize]);

  const completedKinds = useMemo(() => new Set(parts.map((part) => part.kind)), [parts]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md overflow-y-auto p-3 sm:p-6">
      <div className="max-w-6xl mx-auto rounded-2xl border border-cyan-300/25 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-cyan-200 font-semibold"><ScanLine className="w-5 h-5" /> Character Rig Studio</div>
            <p className="text-xs text-slate-400 mt-1">{asset.name} · Manual polygon cutout prototype</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-300" aria-label="Close rig studio"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 p-4">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-200">Tap around one body part to trace its outline.</div>
              <span className="text-xs text-slate-400">{imageSize.width} × {imageSize.height}</span>
            </div>
            <div className="rounded-xl bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] border border-white/10 p-2">
              {loading ? <div className="py-24 text-center text-slate-400">Loading image…</div> : (
                <canvas ref={canvasRef} onClick={handleCanvasClick} className="block w-full h-auto max-h-[62vh] object-contain mx-auto cursor-crosshair touch-manipulation" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPoints((current) => current.slice(0, -1))} disabled={!points.length} className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-200 disabled:opacity-40"><Undo2 className="w-3.5 h-3.5 inline mr-1" />Undo point</button>
              <button type="button" onClick={() => { setPoints([]); setPivot(null); setSettingPivot(false); }} disabled={!points.length && !pivot} className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-200 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5 inline mr-1" />Clear trace</button>
              <button type="button" onClick={() => setSettingPivot(true)} disabled={points.length < 3} className={`px-3 py-2 rounded-lg border text-xs ${settingPivot ? 'border-amber-300 text-amber-200' : 'border-white/10 text-slate-200'} disabled:opacity-40`}>Set joint pivot</button>
              <button type="button" onClick={savePart} disabled={points.length < 3} className="px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-300/30 text-xs text-cyan-100 disabled:opacity-40"><Plus className="w-3.5 h-3.5 inline mr-1" />Save cutout</button>
            </div>
            {settingPivot && <p className="text-xs text-amber-200">Tap the joint location (for example, shoulder, elbow or hip) on the image.</p>}
            {error && <p className="text-xs text-rose-300">{error}</p>}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-3">
              <label className="block text-xs text-slate-400">Body part to trace</label>
              <select value={kind} onChange={(event) => setKind(event.target.value as PartKind)} className="w-full rounded-lg bg-slate-800 border border-white/10 p-2 text-sm text-white">
                {PART_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}{completedKinds.has(option.value) ? ' ✓' : ''}</option>)}
              </select>
              <p className="text-xs text-slate-400">Trace each part as a polygon. Choose a pivot to define where that cutout rotates.</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-2">
              <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-white">Rig parts</h3><span className="text-xs text-cyan-300">{parts.length}/6</span></div>
              {parts.length === 0 ? <p className="text-xs text-slate-500">No parts saved yet.</p> : parts.map((part) => (
                <div key={part.id} className="flex items-center justify-between gap-2 text-xs text-slate-200">
                  <span className="capitalize">{part.kind.replace('-', ' ')}</span>
                  <button type="button" onClick={() => setParts((current) => current.filter((item) => item.id !== part.id))} className="text-slate-500 hover:text-rose-300" aria-label={`Remove ${part.kind}`}><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-2">
              <h3 className="text-sm font-medium text-white">Cutout preview</h3>
              <div className="rounded-lg bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[length:16px_16px] p-1">
                <canvas ref={previewRef} className="w-full h-auto max-h-48 object-contain" />
              </div>
              <button type="button" onClick={() => setPreviewing((value) => !value)} disabled={!parts.length} className="w-full px-3 py-2 rounded-lg border border-cyan-300/25 text-xs text-cyan-100 disabled:opacity-40">
                {previewing ? <Pause className="w-3.5 h-3.5 inline mr-1" /> : <Play className="w-3.5 h-3.5 inline mr-1" />}{previewing ? 'Stop motion preview' : 'Preview joint motion'}
              </button>
              <p className="text-[11px] text-slate-500">Preview uses simple pivot rotation, not a finished walk/run rig.</p>
            </div>

            <button type="button" onClick={downloadRig} disabled={!parts.length} className="w-full px-3 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-medium text-white disabled:opacity-40">
              <Download className="w-4 h-4 inline mr-2" />Export PNG parts + rig JSON
            </button>
            <button type="button" onClick={() => { setParts([]); setPoints([]); setPivot(null); setPreviewing(false); }} disabled={!parts.length && !points.length} className="w-full px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-300 disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5 inline mr-1" />Reset rig</button>
          </aside>
        </div>
        <div className="px-4 pb-4 text-[11px] text-slate-500">This prototype uses manual polygon masking. It does not yet automatically detect body parts or fill hidden pixels behind separated limbs. Trace overlapping parts carefully and export transparent cutouts for the next rigging stage.</div>
      </div>
    </div>
  );
};
