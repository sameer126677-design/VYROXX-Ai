import React, { useEffect, useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  History,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Paperclip,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  AppSettings,
  AttachedFileItem,
  ChatThreadRecord,
  GenerationJobRecord,
  ProjectRecord,
  UserProfileRecord,
} from '../types';
import { AnimationScenePlan } from '../shared/sceneSchema';
import type { CreationExecutionPlan } from '../engine/capabilities/capabilityEngine';
import { AiAssistantAvatar, UserAvatar } from './BrandLogo';
import { AnimationPreviewPlayer } from './AnimationCanvas';
import { PromptComposer } from './PromptComposer';

interface WorkspaceViewProps {
  project: ProjectRecord;
  chatThread: ChatThreadRecord | null;
  activeJob: GenerationJobRecord | null;
  user: UserProfileRecord;
  settings: AppSettings;
  onSendMessage: (
    promptText: string,
    attachments: AttachedFileItem[],
    rawFiles: File[]
  ) => void;
  onRetryPrompt: (promptText: string, attachments?: AttachedFileItem[]) => void;
  onRegenerateMessage: (messageId: string) => void;
  onOpenExport: (scenePlan: AnimationScenePlan, projectTitle: string) => void;
  onOpenRename: () => void;
  onOpenVersionHistory: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearHistory: () => void;
  onNewProject: () => void;
  isGenerating: boolean;
  regeneratingMsgId: string | null;
  autosaveError?: string | null;
  pendingAttachments?: AttachedFileItem[];
  onClearPendingAttachments?: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  project,
  chatThread,
  activeJob,
  user,
  settings,
  onSendMessage,
  onRetryPrompt,
  onRegenerateMessage,
  onOpenExport,
  onOpenRename,
  onOpenVersionHistory,
  onUndo,
  onRedo,
  onClearHistory,
  onNewProject,
  isGenerating,
  regeneratingMsgId,
  autosaveError = null,
  pendingAttachments = [],
  onClearPendingAttachments,
}) => {
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const firstName = user.displayName.split(' ')[0] || 'Creator';

  const messages = chatThread?.messages || [];
  const versions = chatThread?.versions || [];
  const historyIndex = chatThread?.historyIndex ?? -1;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating, activeJob?.status]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < versions.length - 1;

  return (
    <div className="h-full w-full flex flex-col justify-between relative overflow-hidden">
      {/* Top Workspace Bar */}
      <div className="w-full px-6 sm:px-10 pt-4 pb-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 z-10 pr-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenRename}
            className="group inline-flex items-center gap-2 text-left text-base sm:text-lg font-medium text-slate-100 hover:text-cyan-300 transition-colors truncate cursor-pointer"
            title="Rename Project"
          >
            <span className="truncate max-w-[240px] sm:max-w-[360px]">{project.title}</span>
            <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 shrink-0" />
          </button>

          <span className="text-xs text-slate-500 hidden sm:inline-block" aria-hidden="true">
            ·
          </span>

          {autosaveError ? (
            <span className="text-xs text-rose-300 font-medium truncate max-w-[280px] sm:max-w-md" title={autosaveError}>
              {autosaveError}
            </span>
          ) : (
            <span className="text-xs text-emerald-300/90 hidden sm:inline-block whitespace-nowrap">
              Saved to Firestore {project.lastModifiedLabel}
            </span>
          )}

          {project.visualContinuity?.characterBible?.length > 0 && (
            <>
              <span className="text-xs text-slate-500 hidden md:inline-block" aria-hidden="true">
                ·
              </span>
              <span
                className="text-xs text-cyan-300/80 hidden md:inline-flex items-center gap-1 whitespace-nowrap"
                title={`Continuity Style: ${project.visualContinuity.artStyle}`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Continuity Active</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || isGenerating}
            title="Undo Scene Edit"
            className="p-2 rounded-lg bg-slate-900/70 hover:bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || isGenerating}
            title="Redo Scene Edit"
            className="p-2 rounded-lg bg-slate-900/70 hover:bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenVersionHistory}
            disabled={versions.length === 0}
            title="Version History"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800/80 border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">
              {versions.length > 0 ? `v${historyIndex + 1} History` : 'History'}
            </span>
          </button>

          {confirmClear ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs">
              <span className="text-rose-200">Clear chat?</span>
              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  setConfirmClear(false);
                }}
                className="text-rose-300 font-semibold hover:underline cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={messages.length === 0 || isGenerating}
              title="Clear Conversation History"
              className="p-2 rounded-lg bg-slate-900/70 hover:bg-rose-950/50 border border-white/10 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-35"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-xs font-medium text-cyan-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Project</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {!chatThread ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <span>Loading conversation history...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              This project workspace is empty. Describe an animation scene below to begin.
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1.5 mr-1">
                      <span className="text-xs font-medium text-sky-300/90">{firstName}</span>
                      <UserAvatar
                        avatarUrl={user.photoURL}
                        name={user.displayName}
                        size={24}
                      />
                    </div>
                    <div className="max-w-2xl rounded-2xl px-5 py-3.5 vyroxx-glass border border-sky-300/35 text-sm sm:text-base text-slate-100 leading-relaxed shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                      <p>{msg.content}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                          {msg.attachments.map((att) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1.5 text-xs text-cyan-300"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{att.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-3.5">
                  <AiAssistantAvatar size={36} />
                  <div className="flex-1 min-w-0 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-sky-300">Jarvis</span>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-400">{msg.timestamp}</span>
                    </div>

                    <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl">
                      {msg.content}
                    </p>

                    {msg.creationPlan && (
                      <div className="max-w-3xl rounded-xl border border-cyan-400/20 bg-slate-950/55 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                            <Sparkles className="w-4 h-4" />
                            VYROXX Creation Director
                          </div>
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            {msg.creationPlan.renderMode} pipeline
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.creationPlan.decisions.map((decision) => (
                            <span key={decision.capability} title={decision.reason} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                              {decision.capability.replace(/-/g, ' ')}
                            </span>
                          ))}
                        </div>
                        {msg.creationPlan.recommendedAssist !== 'local-render' && (
                          <p className="text-xs text-amber-200">
                            Suggested support: {msg.creationPlan.recommendedAssist === 'video-model' ? 'External video model may be needed' : 'External image model may help create source assets'}.
                          </p>
                        )}
                        {msg.creationPlan.notes.map((note, index) => (
                          <p key={index} className="text-xs text-slate-400">{note}</p>
                        ))}
                      </div>
                    )}

                    {msg.status === 'failed' ? (
                      <div className="max-w-xl rounded-2xl p-5 bg-rose-950/40 border border-rose-500/40 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3 text-rose-200 text-xs sm:text-sm">
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            {msg.error || 'Scene generation failed. You can retry this request.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = messages.findIndex((m) => m.id === msg.id);
                            const prevUser = [...messages.slice(0, idx >= 0 ? idx : undefined)]
                              .reverse()
                              .find((m) => m.role === 'user');
                            onRetryPrompt(
                              prevUser?.content || project.title,
                              prevUser?.attachments
                            );
                          }}
                          disabled={isGenerating}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-xs font-medium text-rose-100 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    ) : (
                      msg.scenePlan && (
                        <AnimationPreviewPlayer
                          scenePlan={msg.scenePlan}
                          autoPlay={settings.autoPlayPreviews}
                          onDownload={() => onOpenExport(msg.scenePlan!, project.title)}
                          onRegenerate={() => onRegenerateMessage(msg.id)}
                          isRegenerating={regeneratingMsgId === msg.id}
                        />
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Real Tracked Generation Job Status */}
          {isGenerating && (
            <div className="flex items-start gap-3.5">
              <AiAssistantAvatar size={36} />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-sky-300">Jarvis</span>
                  <span className="text-xs text-cyan-300/80 capitalize">
                    {activeJob?.status || 'planning'}...
                  </span>
                </div>
                <div className="max-w-3xl rounded-2xl p-5 vyroxx-glass border border-cyan-400/30 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="text-sm font-medium text-slate-100">
                      {activeJob?.stageLabel || 'Generating structured animation plan with VYROXX AI...'}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                        style={{ width: `${activeJob?.progress ?? 30}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>
      </div>

      {/* Bottom Prompt Composer */}
      <div className="w-full px-4 sm:px-10 pb-6 pt-2 z-10">
        <div className="max-w-4xl mx-auto">
          <PromptComposer
            placeholder="Ask to edit, change style, or type a new prompt..."
            variant="workspace"
            onSubmit={onSendMessage}
            initialAttachments={pendingAttachments}
            onClearInitialAttachments={onClearPendingAttachments}
            disabled={isGenerating}
          />
        </div>
      </div>
    </div>
  );
};
