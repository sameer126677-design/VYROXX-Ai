import React, { useRef, useState } from 'react';
import {
  Paperclip,
  SlidersHorizontal,
  Mic,
  ArrowUp,
  ArrowRight,
  X,
  Film,
  Sparkles,
  CloudRain,
  Camera,
  Plane,
} from 'lucide-react';
import { AttachedFileItem } from '../types';

interface PromptComposerProps {
  placeholder: string;
  variant: 'home' | 'workspace';
  onSubmit: (
    promptText: string,
    attachments: AttachedFileItem[],
    rawFiles: File[]
  ) => void;
  initialAttachments?: AttachedFileItem[];
  onClearInitialAttachments?: () => void;
  disabled?: boolean;
}

const CREATION_TOOLS = [
  {
    id: 'cinematic-light',
    label: 'Cinematic Lighting',
    snippet: 'with dramatic anamorphic cinematic lighting',
    icon: Sparkles,
  },
  {
    id: 'flying-vehicles',
    label: 'Flying Vehicles',
    snippet: 'add flying vehicles streaking through the sky',
    icon: Plane,
  },
  {
    id: 'heavy-rain',
    label: 'Rain & Reflections',
    snippet: 'with heavy rain and atmospheric reflections',
    icon: CloudRain,
  },
  {
    id: 'camera-chase',
    label: 'Dynamic Tracking Camera',
    snippet: 'with an intense tracking pursuit camera motion',
    icon: Camera,
  },
  {
    id: 'slow-motion',
    label: 'Slow-Motion Zoom',
    snippet: 'rendered with gradual zoom-in camera pacing',
    icon: Film,
  },
];

export const PromptComposer: React.FC<PromptComposerProps> = ({
  placeholder,
  variant,
  onSubmit,
  initialAttachments = [],
  onClearInitialAttachments,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [localAttachments, setLocalAttachments] = useState<
    { item: AttachedFileItem; file: File }[]
  >([]);
  const [showToolsPopover, setShowToolsPopover] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const combinedAttachments = [
    ...initialAttachments,
    ...localAttachments.map((x) => x.item),
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const added = Array.from(files).map((file, idx) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: AttachedFileItem['type'] = 'document';
      if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) type = 'image';
      else if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
      else if (['mp3', 'wav', 'ogg'].includes(ext)) type = 'audio';

      const sizeKB = Math.max(1, Math.round(file.size / 1024));
      return {
        file,
        item: {
          id: `att-${Date.now()}-${idx}`,
          name: file.name,
          size: sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`,
          mimeType: file.type || 'application/octet-stream',
          type,
        },
      };
    });

    setLocalAttachments((prev) => [...prev, ...added]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    if (initialAttachments.some((a) => a.id === id)) {
      onClearInitialAttachments?.();
    } else {
      setLocalAttachments((prev) => prev.filter((a) => a.item.id !== id));
    }
  };

  const handleApplyTool = (snippet: string) => {
    setText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return variant === 'home'
          ? `Create an animation scene ${snippet}.`
          : `Update the current scene ${snippet}.`;
      }
      return `${trimmed}, ${snippet}`;
    });
    setShowToolsPopover(false);
  };

  // Real browser Web Speech API dictation if supported
  const handleVoiceToggle = () => {
    setVoiceError(null);
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceError('Speech recognition is not supported in this browser.');
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec() as {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setText((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setVoiceError('Microphone dictation could not be completed.');
      };
      rec.onend = () => setIsListening(false);
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
      setVoiceError('Microphone permission is required for voice dictation.');
    }
  };

  const triggerSubmit = () => {
    const trimmed = text.trim();
    if ((!trimmed && combinedAttachments.length === 0) || disabled) return;

    const finalPrompt =
      trimmed ||
      `Create an animation incorporating attached reference: ${combinedAttachments
        .map((a) => a.name)
        .join(', ')}`;

    const rawFiles = localAttachments.map((x) => x.file);
    onSubmit(finalPrompt, combinedAttachments, rawFiles);
    setText('');
    setLocalAttachments([]);
    onClearInitialAttachments?.();
    setShowToolsPopover(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      triggerSubmit();
    }
  };

  return (
    <div className="relative w-full">
      {voiceError && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200">
          {voiceError}
        </div>
      )}

      {showToolsPopover && (
        <div className="absolute bottom-full left-12 mb-3 w-72 rounded-2xl vyroxx-glass p-3 z-30 shadow-[0_20px_50px_rgba(0,0,0,0.75)] border border-cyan-300/30">
          <div className="flex items-center justify-between px-2 pb-2 mb-1.5 border-b border-white/10">
            <span className="text-xs font-medium text-cyan-300">Scene Refinement Tools</span>
            <button
              type="button"
              onClick={() => setShowToolsPopover(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {CREATION_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleApplyTool(tool.snippet)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs text-slate-200 hover:bg-cyan-500/15 hover:text-white transition-colors cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="truncate">
                    <div className="font-medium">{tool.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">{tool.snippet}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`w-full rounded-[26px] transition-all ${
          variant === 'home'
            ? 'vyroxx-glass p-5 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.65),0_0_40px_rgba(37,99,235,0.18)] border border-sky-300/30'
            : 'vyroxx-glass px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.6)] border border-sky-300/25'
        }`}
      >
        {combinedAttachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-2.5 border-b border-white/10">
            {combinedAttachments.map((file) => (
              <div
                key={file.id}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/90 border border-cyan-400/30 text-xs text-slate-200"
              >
                <Paperclip className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate max-w-[180px]">{file.name}</span>
                <span className="text-slate-400 text-[11px] font-mono-tabular">({file.size})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(file.id)}
                  className="text-slate-400 hover:text-rose-300 ml-0.5 cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          rows={variant === 'home' ? 3 : 2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening for voice prompt...' : placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-slate-100 placeholder:text-slate-400/80 text-sm sm:text-base resize-none focus:outline-none leading-relaxed"
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.svg,.mp4,.webm,.mov,.mp3,.wav,.ogg,.json,.txt,.pdf,.glb,.gltf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center justify-between pt-3 mt-1">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/75 hover:bg-slate-700/80 border border-slate-400/25 text-xs sm:text-sm font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Paperclip className="w-4 h-4 text-slate-300" />
              <span>Attach</span>
            </button>

            <button
              type="button"
              onClick={() => setShowToolsPopover((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showToolsPopover
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-slate-800/75 hover:bg-slate-700/80 border-slate-400/25 text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-300" />
              <span>Tools</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleVoiceToggle}
              title={isListening ? 'Stop Voice Input' : 'Voice Dictation'}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                isListening
                  ? 'bg-rose-500/25 text-rose-300 ring-2 ring-rose-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>

            {variant === 'home' ? (
              <button
                type="button"
                onClick={triggerSubmit}
                disabled={disabled || (!text.trim() && combinedAttachments.length === 0)}
                title="Generate Animation"
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 hover:brightness-110 disabled:opacity-45 flex items-center justify-center text-white shadow-[0_0_24px_rgba(59,130,246,0.75)] border border-cyan-300/50 transition-all cursor-pointer shrink-0"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={triggerSubmit}
                disabled={disabled || (!text.trim() && combinedAttachments.length === 0)}
                title="Send Prompt"
                className="p-2 rounded-xl text-slate-300 hover:text-cyan-300 hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
