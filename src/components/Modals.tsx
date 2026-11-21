import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  Upload,
  CheckCircle2,
  Download,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
  History,
  FileText,
  Loader2,
  Info,
} from 'lucide-react';
import {
  AppSettings,
  AssetCategory,
  AssetRecord,
  ChatThreadRecord,
  ExportConfig,
  ProjectRecord,
  ProjectVersion,
} from '../types';
import { AnimationScenePlan } from '../shared/sceneSchema';
import { VyroxxVLogo } from './BrandLogo';
import { exportRenderedAnimation, ExportResult } from '../engine/videoExporter';
import { fetchAuthenticatedAssetBlobUrl, uploadAssetBinary } from '../lib/apiClient';
import { createAssetRecord, getReadableErrorMessage } from '../lib/firestoreService';
import { MAX_UPLOAD_BYTES, validateUploadBytes } from '../shared/uploadValidation';

function sanitizeFileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'vyroxx_animation'
  );
}

// 1. EXPORT DIALOG
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectName: string;
  scenePlan: AnimationScenePlan;
  settings: AppSettings;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  defaultProjectName,
  scenePlan,
  settings,
}) => {
  const [config, setConfig] = useState<ExportConfig>({
    fileName: sanitizeFileSlug(defaultProjectName),
    format: settings.defaultExportFormat || 'WebM',
    resolutionPreset: 'Custom',
    width: scenePlan.width || settings.defaultWidth || 1280,
    height: scenePlan.height || settings.defaultHeight || 720,
    fpsPreset:
      settings.defaultFps === 'custom'
        ? 'Custom'
        : ((settings.defaultFps as '24' | '30' | '60') || '30'),
    customFps: settings.customDefaultFps || 30,
    quality: settings.defaultExportQuality || 'High',
    includeAudio: false,
    background: settings.defaultBackground || 'Original',
  });

  const [showAdditional, setShowAdditional] = useState(true);
  const [exportState, setExportState] = useState<'idle' | 'rendering' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig((prev) => ({
        ...prev,
        fileName: sanitizeFileSlug(defaultProjectName),
        width: scenePlan.width || prev.width,
        height: scenePlan.height || prev.height,
        fpsPreset:
          scenePlan.fps === 24 || scenePlan.fps === 30 || scenePlan.fps === 60
            ? (String(scenePlan.fps) as '24' | '30' | '60')
            : 'Custom',
        customFps: scenePlan.fps || 30,
      }));
      setExportState('idle');
      setProgress(0);
      setStageLabel('');
      setErrorMsg(null);
      setExportResult(null);
    } else {
      abortControllerRef.current?.abort();
    }
  }, [isOpen, defaultProjectName, scenePlan]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  if (!isOpen) return null;

  const handleResolutionPreset = (preset: ExportConfig['resolutionPreset']) => {
    let width = config.width;
    let height = config.height;
    if (preset === '720p') {
      width = 1280;
      height = 720;
    } else if (preset === '1080p') {
      width = 1920;
      height = 1080;
    } else if (preset === '1440p') {
      width = 2560;
      height = 1440;
    } else if (preset === '4K') {
      width = 3840;
      height = 2160;
    }
    setConfig((p) => ({ ...p, resolutionPreset: preset, width, height }));
  };

  const handleStartExport = async () => {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    setExportResult(null);
    setErrorMsg(null);
    setProgress(2);
    setStageLabel('Initializing canvas renderer...');
    setExportState('rendering');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await exportRenderedAnimation(
        scenePlan,
        config,
        (pct, label) => {
          setProgress(pct);
          setStageLabel(label);
        },
        controller.signal
      );
      const url = URL.createObjectURL(result.blob);
      setExportResult(result);
      setDownloadUrl(url);
      setExportState('completed');
    } catch (err) {
      if (controller.signal.aborted) {
        setExportState('idle');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : 'Animation export failed.');
      setExportState('failed');
    }
  };

  const handleCancelRender = () => {
    abortControllerRef.current?.abort();
    setExportState('idle');
  };

  const handleTriggerDownload = () => {
    if (!downloadUrl || !exportResult) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${sanitizeFileSlug(config.fileName)}.${exportResult.actualExtension}`;
    a.click();
  };

  const transparentSupported = config.format === 'WebM' || config.format === 'GIF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-[440px] rounded-3xl vyroxx-glass p-7 border border-cyan-400/35 shadow-[0_0_60px_rgba(34,211,238,0.22)]">
        <button
          type="button"
          onClick={() => {
            abortControllerRef.current?.abort();
            onClose();
          }}
          className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
          title="Close Export Dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-5">
          <VyroxxVLogo size={46} className="mb-2" />
          <h2 className="text-2xl sm:text-3xl font-normal text-slate-100 tracking-wide">
            Export Settings
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              File Name
            </label>
            <input
              type="text"
              value={config.fileName}
              disabled={exportState === 'rendering'}
              onChange={(e) => setConfig((p) => ({ ...p, fileName: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl vyroxx-input border-cyan-400/75 text-sm text-white shadow-[0_0_14px_rgba(56,189,248,0.22)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Format
              </label>
              <div className="flex items-center p-1 rounded-xl bg-slate-900/85 border border-white/10">
                {(['WebM', 'MP4', 'GIF'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={exportState === 'rendering'}
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        format: fmt,
                        background: fmt === 'MP4' ? 'Original' : p.background,
                      }))
                    }
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      config.format === fmt
                        ? 'bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Resolution Preset
              </label>
              <select
                value={config.resolutionPreset}
                disabled={exportState === 'rendering'}
                onChange={(e) =>
                  handleResolutionPreset(e.target.value as ExportConfig['resolutionPreset'])
                }
                className="w-full px-3 py-2 rounded-xl vyroxx-input text-xs sm:text-sm text-white cursor-pointer"
              >
                <option value="720p" className="bg-slate-900">
                  720p (1280×720)
                </option>
                <option value="1080p" className="bg-slate-900">
                  1080p (1920×1080)
                </option>
                <option value="1440p" className="bg-slate-900">
                  1440p (2560×1440)
                </option>
                <option value="4K" className="bg-slate-900">
                  4K (3840×2160)
                </option>
                <option value="Custom" className="bg-slate-900">
                  Custom Width × Height
                </option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm text-slate-300">Custom Dimensions</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={128}
                max={3840}
                disabled={exportState === 'rendering'}
                value={config.width}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    resolutionPreset: 'Custom',
                    width: Math.max(128, Math.min(3840, Number(e.target.value) || 1280)),
                  }))
                }
                className="w-20 px-2.5 py-2 rounded-xl vyroxx-input text-xs sm:text-sm text-center font-mono-tabular"
              />
              <span className="text-xs text-slate-400">x</span>
              <input
                type="number"
                min={128}
                max={2160}
                disabled={exportState === 'rendering'}
                value={config.height}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    resolutionPreset: 'Custom',
                    height: Math.max(128, Math.min(2160, Number(e.target.value) || 720)),
                  }))
                }
                className="w-20 px-2.5 py-2 rounded-xl vyroxx-input text-xs sm:text-sm text-center font-mono-tabular"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-300">FPS</span>
            <div className="flex items-center gap-2 w-60">
              <select
                value={config.fpsPreset}
                disabled={exportState === 'rendering'}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    fpsPreset: e.target.value as ExportConfig['fpsPreset'],
                  }))
                }
                className="flex-1 px-3.5 py-2 rounded-xl vyroxx-input text-xs sm:text-sm text-white font-mono-tabular cursor-pointer"
              >
                <option value="24" className="bg-slate-900">
                  24
                </option>
                <option value="30" className="bg-slate-900">
                  30
                </option>
                <option value="60" className="bg-slate-900">
                  60
                </option>
                <option value="Custom" className="bg-slate-900">
                  Custom FPS
                </option>
              </select>
              {config.fpsPreset === 'Custom' && (
                <input
                  type="number"
                  min={12}
                  max={60}
                  disabled={exportState === 'rendering'}
                  value={config.customFps}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      customFps: Math.max(12, Math.min(60, Number(e.target.value) || 30)),
                    }))
                  }
                  className="w-16 px-2 py-2 rounded-xl vyroxx-input text-xs font-mono-tabular text-center"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-300">Quality</span>
            <div className="w-60 flex items-center p-1 rounded-xl bg-slate-900/90 border border-white/10">
              {(['Standard', 'High', 'Maximum'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={exportState === 'rendering'}
                  onClick={() => setConfig((p) => ({ ...p, quality: q }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    config.quality === q
                      ? 'bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_14px_rgba(34,211,238,0.55)]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/65 border border-white/15 p-4 space-y-3.5">
            <button
              type="button"
              onClick={() => setShowAdditional((v) => !v)}
              className="w-full flex items-center justify-between text-xs sm:text-sm font-medium text-slate-200 cursor-pointer"
            >
              <span>Additional Settings</span>
              {showAdditional ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdditional && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-slate-300">Background</span>
                  <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-white/10">
                    <button
                      type="button"
                      disabled={exportState === 'rendering'}
                      onClick={() => setConfig((p) => ({ ...p, background: 'Original' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        config.background === 'Original'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      disabled={!transparentSupported || exportState === 'rendering'}
                      onClick={() =>
                        setConfig((p) => ({ ...p, background: 'Transparent' }))
                      }
                      title={
                        transparentSupported
                          ? 'Transparent alpha channel'
                          : 'Switch to WebM or GIF for Transparent Background'
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                        config.background === 'Transparent'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Transparent
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {exportState === 'rendering' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-300 font-mono-tabular">
                <span className="truncate pr-2">{stageLabel || 'Rendering frames...'}</span>
                <span className="shrink-0">{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.8)] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {exportState === 'failed' && errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/45 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {exportState === 'completed' && exportResult ? (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-emerald-950/65 border border-emerald-400/45 flex items-start gap-2.5 text-xs text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">
                    Render Complete ({sanitizeFileSlug(config.fileName)}.{exportResult.actualExtension})
                  </div>
                  <div className="text-emerald-200/80 mt-0.5">
                    {(exportResult.blob.size / 1024).toFixed(0)} KB · {config.width}×{config.height}
                  </div>
                </div>
              </div>

              {exportResult.note && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-400/25 flex items-start gap-2 text-[11px] text-slate-300 leading-relaxed">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{exportResult.note}</span>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTriggerDownload}
                  className="flex-1 py-3 rounded-xl vyroxx-btn-primary text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Save .{exportResult.actualExtension.toUpperCase()} File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportState('idle')}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
                >
                  Adjust
                </button>
              </div>
            </div>
          ) : exportState === 'rendering' ? (
            <button
              type="button"
              onClick={handleCancelRender}
              className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-sm font-semibold text-slate-200 cursor-pointer"
            >
              Cancel Rendering
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartExport}
              className="w-full py-3.5 rounded-xl vyroxx-btn-primary text-sm sm:text-base font-semibold cursor-pointer"
            >
              Export Animation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. UPLOAD ASSET MODAL
interface UploadAssetModalProps {
  isOpen: boolean;
  uid: string;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export const UploadAssetModal: React.FC<UploadAssetModalProps> = ({
  isOpen,
  uid,
  onClose,
  onUploadComplete,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [categoryOverride, setCategoryOverride] = useState<AssetCategory | 'Auto'>('Auto');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setUploadStatus('idle');
      setProgress(0);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setSelectedFiles(Array.from(e.target.files));
    setUploadStatus('idle');
    setErrorMsg(null);
  };

  const detectCategory = (file: File): AssetCategory => {
    if (categoryOverride !== 'Auto') return categoryOverride;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'Images';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'Videos';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'Audio';
    return 'Other Files';
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploadStatus('uploading');
    setErrorMsg(null);
    setProgress(5);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`"${file.name}" exceeds the 20 MB file upload limit.`);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const validation = validateUploadBytes(
          file.name,
          file.type || 'application/octet-stream',
          bytes
        );
        if (!validation.ok) {
          throw new Error(`"${file.name}" rejected: ${validation.error}`);
        }

        const cat = detectCategory(file);
        const ext = (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 20);
        const sizeKB = Math.max(1, Math.round(file.size / 1024));
        const sizeLabel =
          sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

        let textPreview: string | null = null;
        if (
          file.type.includes('json') ||
          file.type.startsWith('text/') ||
          ext === 'JSON' ||
          ext === 'TXT'
        ) {
          try {
            const rawText = await file.text();
            textPreview = rawText.slice(0, 18000);
          } catch {
            textPreview = null;
          }
        }

        const uploaded = await uploadAssetBinary(file);

        await createAssetRecord(uid, {
          name: file.name.replace(/\.[^/.]+$/, '').slice(0, 160) || file.name,
          category: cat,
          mimeType: file.type || 'application/octet-stream',
          fileFormat: ext,
          fileSizeBytes: uploaded.fileSizeBytes,
          fileSizeLabel: sizeLabel,
          source: 'Uploaded',
          storagePath: uploaded.storagePath,
          associatedProjectId: null,
          favorited: false,
          textPreview,
        });

        setProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      onUploadComplete?.();
      onClose();
    } catch (err) {
      setErrorMsg(getReadableErrorMessage(err, 'Asset upload failed.'));
      setUploadStatus('failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-2xl vyroxx-glass p-6 border border-cyan-300/35">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Upload Assets</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.svg,.mp4,.webm,.mov,.mp3,.wav,.ogg,.json,.txt,.pdf,.glb,.gltf"
          onChange={handleFilesSelected}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-cyan-400/35 hover:border-cyan-400/70 rounded-2xl p-7 text-center bg-slate-900/50 cursor-pointer transition-colors mb-4"
        >
          <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
          <div className="text-sm font-medium text-white">
            Click to select files from your device
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Supports PNG, JPG, WebP, SVG, MP4, WebM, MOV, MP3, WAV, JSON, TXT, PDF, GLB, GLTF (max 20 MB)
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mb-4 max-h-32 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 text-xs text-slate-200"
              >
                <span className="truncate max-w-[240px]">{f.name}</span>
                <span className="text-slate-400 font-mono-tabular">
                  {Math.max(1, Math.round(f.size / 1024))} KB
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-4">
          <label className="text-xs text-slate-300">Category Assignment</label>
          <select
            value={categoryOverride}
            disabled={uploadStatus === 'uploading'}
            onChange={(e) => setCategoryOverride(e.target.value as AssetCategory | 'Auto')}
            className="px-3 py-1.5 rounded-xl vyroxx-input text-xs text-white"
          >
            <option value="Auto" className="bg-slate-900">
              Auto-detect by file type
            </option>
            <option value="Characters" className="bg-slate-900">
              Characters
            </option>
            <option value="Backgrounds" className="bg-slate-900">
              Backgrounds
            </option>
            <option value="Props" className="bg-slate-900">
              Props
            </option>
            <option value="Images" className="bg-slate-900">
              Images
            </option>
            <option value="Videos" className="bg-slate-900">
              Videos
            </option>
            <option value="Audio" className="bg-slate-900">
              Audio
            </option>
            <option value="Other Files" className="bg-slate-900">
              Other Files
            </option>
          </select>
        </div>

        {uploadStatus === 'uploading' && (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between text-xs text-cyan-300 font-mono-tabular">
              <span>Uploading {selectedFiles.length} file(s)...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {uploadStatus === 'failed' && errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/45 flex items-center justify-between gap-2 text-xs text-rose-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={handleStartUpload}
              className="px-2.5 py-1 rounded bg-rose-500/30 text-white font-medium cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedFiles.length === 0 || uploadStatus === 'uploading'}
            onClick={handleStartUpload}
            className="px-5 py-2 rounded-xl vyroxx-btn-primary text-xs font-semibold disabled:opacity-45 cursor-pointer inline-flex items-center gap-2"
          >
            {uploadStatus === 'uploading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Upload to Library</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. ASSET PREVIEW MODAL
interface AssetPreviewModalProps {
  asset: AssetRecord | null;
  onClose: () => void;
  onReuseInProject: (asset: AssetRecord) => void;
  onDownloadAsset: (asset: AssetRecord) => void;
}

export const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
  asset,
  onClose,
  onReuseInProject,
  onDownloadAsset,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!asset || !asset.storagePath) {
      setBlobUrl(null);
      return;
    }

    const needsBinary =
      asset.mimeType.startsWith('image/') ||
      asset.mimeType.startsWith('video/') ||
      asset.mimeType.startsWith('audio/');

    if (!needsBinary) {
      setBlobUrl(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setLoadError(null);

    fetchAuthenticatedAssetBlobUrl(asset.storagePath)
      .then((url) => {
        createdUrl = url;
        if (active) setBlobUrl(url);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load asset file.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [asset]);

  if (!asset) return null;

  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-2xl vyroxx-glass p-6 border border-cyan-300/35">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0 pr-4">
            <h3 className="text-xl font-semibold text-white truncate">{asset.name}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{asset.category}</span>
              <span>·</span>
              <span>{asset.source}</span>
              <span>·</span>
              <span className="font-mono-tabular">
                {asset.fileFormat} ({asset.fileSizeLabel})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-xl overflow-hidden bg-slate-950 border border-white/10 mb-5 min-h-[220px] flex items-center justify-center">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
              <span>Loading encrypted user asset...</span>
            </div>
          ) : loadError ? (
            <div className="p-8 text-center text-xs text-rose-300 flex flex-col items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <span>{loadError}</span>
            </div>
          ) : isVideo && blobUrl ? (
            <video
              src={blobUrl}
              controls
              playsInline
              className="w-full max-h-[380px] object-contain bg-black"
            />
          ) : isAudio && blobUrl ? (
            <div className="w-full p-8 flex flex-col items-center gap-4">
              <div className="text-sm font-medium text-white">
                {asset.name}.{asset.fileFormat.toLowerCase()}
              </div>
              <audio src={blobUrl} controls className="w-full max-w-md" />
            </div>
          ) : isImage && blobUrl ? (
            <img
              src={blobUrl}
              alt={asset.name}
              referrerPolicy="no-referrer"
              className="w-full max-h-[380px] object-contain"
            />
          ) : asset.textPreview ? (
            <div className="w-full p-5 text-left font-mono text-xs text-cyan-200 bg-slate-950 max-h-72 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{asset.textPreview}</pre>
            </div>
          ) : (
            <div className="p-10 flex flex-col items-center text-center gap-2 text-slate-400 text-xs">
              <FileText className="w-10 h-10 text-cyan-400/70" />
              <span>
                {asset.name}.{asset.fileFormat.toLowerCase()} ({asset.fileSizeLabel})
              </span>
              <span>Click Download Asset below to open this file locally.</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onDownloadAsset(asset)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs font-medium text-slate-200 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Asset</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onReuseInProject(asset);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl vyroxx-btn-primary text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reuse in Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. REUSE ASSET IN PROJECT MODAL
interface ReuseAssetModalProps {
  asset: AssetRecord | null;
  projects: ProjectRecord[];
  onClose: () => void;
  onSelectProject: (projectId: string | 'new', asset: AssetRecord) => void;
}

export const ReuseAssetModal: React.FC<ReuseAssetModalProps> = ({
  asset,
  projects,
  onClose,
  onSelectProject,
}) => {
  if (!asset) return null;
  const activeProjects = projects.filter((p) => !p.deletedAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-2xl vyroxx-glass p-6 border border-cyan-300/35">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Reuse Asset in Project</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mb-4">
          Select a project to attach{' '}
          <span className="text-cyan-300 font-semibold">{asset.name}</span> to its Creation
          Workspace:
        </p>

        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 pr-1">
          <button
            type="button"
            onClick={() => onSelectProject('new', asset)}
            className="w-full p-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-left flex items-center justify-between text-xs font-medium text-cyan-200 cursor-pointer"
          >
            <span>+ Start a New Project with this Asset</span>
            <span>Create</span>
          </button>

          {activeProjects.map((proj) => (
            <button
              key={proj.id}
              type="button"
              onClick={() => onSelectProject(proj.id, asset)}
              className="w-full p-3 rounded-xl bg-slate-900/75 hover:bg-slate-800 border border-white/10 text-left flex items-center justify-between text-xs text-slate-200 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 truncate">
                <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate font-medium">{proj.title}</span>
              </div>
              <span className="text-slate-400 shrink-0">{proj.lastModifiedLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// 5. VERSION HISTORY MODAL
interface VersionHistoryModalProps {
  isOpen: boolean;
  project: ProjectRecord;
  chatThread: ChatThreadRecord | null;
  onClose: () => void;
  onRestoreVersion: (index: number, version: ProjectVersion) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  project,
  chatThread,
  onClose,
  onRestoreVersion,
}) => {
  if (!isOpen) return null;

  const versions = chatThread?.versions || [];
  const historyIndex = chatThread?.historyIndex ?? -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-2xl vyroxx-glass p-6 border border-cyan-300/35">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0 pr-3">
            <History className="w-5 h-5 text-cyan-400 shrink-0" />
            <h3 className="text-lg font-semibold text-white truncate">
              Version History — {project.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {versions.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No saved versions yet for this project.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {versions.map((ver, idx) => {
              const isCurrent = idx === historyIndex;
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                    isCurrent
                      ? 'bg-cyan-500/15 border-cyan-400/50'
                      : 'bg-slate-900/75 border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                      <span>Version {ver.version}</span>
                      <span>·</span>
                      <span className="text-slate-400 font-normal">{ver.timestamp}</span>
                      {isCurrent && (
                        <span className="text-emerald-300 font-medium">(Active)</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 mt-1 line-clamp-2">{ver.prompt}</p>
                  </div>

                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => {
                        onRestoreVersion(idx, ver);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/25 border border-cyan-400/30 text-xs font-medium text-cyan-200 shrink-0 cursor-pointer"
                    >
                      Restore
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// 6. RENAME MODAL & CONFIRMATION DIALOGS
interface RenameModalProps {
  isOpen: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  title,
  initialValue,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    setName(initialValue);
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl vyroxx-glass p-6 border border-cyan-300/35">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl vyroxx-input text-sm text-white mb-5"
          autoFocus
        />
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onSave(name.trim());
                onClose();
              }
            }}
            className="px-5 py-2 rounded-xl vyroxx-btn-primary text-xs font-semibold cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl vyroxx-glass p-6 border border-rose-500/35">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">{description}</p>
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
