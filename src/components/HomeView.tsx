import React from 'react';
import { AttachedFileItem, UserProfileRecord } from '../types';
import { PromptComposer } from './PromptComposer';

interface HomeViewProps {
  user: UserProfileRecord;
  onSubmitPrompt: (
    promptText: string,
    attachments: AttachedFileItem[],
    rawFiles: File[]
  ) => void;
  pendingAttachments?: AttachedFileItem[];
  onClearPendingAttachments?: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  onSubmitPrompt,
  pendingAttachments = [],
  onClearPendingAttachments,
  isSubmitting = false,
  submitError = null,
}) => {
  const firstName = user.displayName.split(' ')[0] || 'Creator';

  return (
    <div className="min-h-full w-full flex flex-col items-center justify-center px-4 sm:px-8 py-16 relative">
      <div
        className="w-[540px] h-[540px] rounded-full pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-[120px] opacity-60"
        style={{
          background:
            'radial-gradient(circle, rgba(37,99,235,0.45) 0%, rgba(14,165,233,0.22) 45%, rgba(5,8,17,0) 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[680px] flex flex-col items-center text-center">
        <p className="text-lg sm:text-2xl font-light text-sky-300/80 tracking-wide mb-2">
          Welcome back, {firstName}
        </p>

        <h1
          className="text-4xl sm:text-6xl font-bold tracking-tight vyroxx-heading-metallic mb-11"
          style={{ textWrap: 'balance' }}
        >
          How can I help you today?
        </h1>

        {submitError && (
          <div className="w-full mb-4 px-4 py-3 rounded-xl bg-rose-950/75 border border-rose-500/40 text-xs text-rose-200 text-left">
            {submitError}
          </div>
        )}

        <PromptComposer
          placeholder="Describe what you want to create..."
          variant="home"
          onSubmit={onSubmitPrompt}
          initialAttachments={pendingAttachments}
          onClearInitialAttachments={onClearPendingAttachments}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
};
