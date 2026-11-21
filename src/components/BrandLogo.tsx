import React, { useEffect, useState } from 'react';
import { fetchAuthenticatedAssetBlobUrl } from '../lib/apiClient';
import { isSafeAvatarUrl } from '../shared/uploadValidation';

export const VyroxxVLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 56,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.65) 0%, rgba(59,130,246,0) 72%)',
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_14px_rgba(56,189,248,0.65)]"
      >
        <defs>
          <linearGradient
            id="vyroxx-v-left"
            x1="12"
            y1="14"
            x2="42"
            y2="68"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient
            id="vyroxx-v-right"
            x1="68"
            y1="14"
            x2="38"
            y2="68"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="45%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient
            id="vyroxx-v-inner"
            x1="26"
            y1="16"
            x2="52"
            y2="54"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          d="M11 16H23.5C27.2 16 30.1 18.2 32.1 22.1L40 39.2L34.8 50.8L11 16Z"
          fill="url(#vyroxx-v-left)"
        />
        <path
          d="M69 16H56.5C52.8 16 49.9 18.2 47.9 22.1L34.8 50.8L40 65L69 16Z"
          fill="url(#vyroxx-v-right)"
        />
        <path
          d="M20.5 16C25.5 23 33.2 37.2 40 53.5C46.8 37.2 54.5 23 59.5 16"
          stroke="url(#vyroxx-v-inner)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 16L40 64.5L65 16"
          stroke="#7dd3fc"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const VyroxxOrbIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 38,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute -inset-1 rounded-full blur-md opacity-70 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(56,189,248,0.65) 0%, rgba(29,78,216,0) 75%)',
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <radialGradient id="orb-core" cx="35%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="35%" stopColor="#38bdf8" />
            <stop offset="72%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#090d1a" />
          </radialGradient>
          <linearGradient
            id="orb-swirl"
            x1="8"
            y1="10"
            x2="40"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="url(#orb-core)"
          stroke="#7dd3fc"
          strokeOpacity="0.45"
          strokeWidth="1.2"
        />
        <path
          d="M11 19C15 11 27 9 35 15C29 13 19 16 16 24C13 31 20 38 30 37C20 41 9 33 11 19Z"
          fill="url(#orb-swirl)"
        />
        <path
          d="M17 17L24 31L31 17"
          stroke="#e0f2fe"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>
    </div>
  );
};

export const UserAvatar: React.FC<{
  avatarUrl?: string | null;
  name?: string;
  size?: number;
  glowRing?: boolean;
  onClick?: () => void;
}> = ({
  avatarUrl,
  name = 'Creator',
  size = 42,
  glowRing = false,
  onClick,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl || !isSafeAvatarUrl(avatarUrl)) {
      setResolvedSrc(null);
      return;
    }
    if (avatarUrl.startsWith('https://')) {
      setResolvedSrc(avatarUrl);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    fetchAuthenticatedAssetBlobUrl(avatarUrl)
      .then((url) => {
        createdUrl = url;
        if (active) setResolvedSrc(url);
      })
      .catch(() => {
        if (active) setResolvedSrc(null);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [avatarUrl]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${name} — Account Profile`}
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 transition-transform hover:scale-105 focus:outline-none overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-sky-950 text-cyan-200 font-semibold select-none cursor-pointer ${
        glowRing
          ? 'ring-2 ring-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.5)]'
          : 'ring-1 ring-slate-300/40 shadow-[0_0_18px_rgba(56,189,248,0.28)]'
      }`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </button>
  );
};

export const AiAssistantAvatar: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <div
    className="relative inline-flex items-center justify-center rounded-full shrink-0 bg-slate-900/90 border border-cyan-400/40 shadow-[0_0_15px_rgba(56,189,248,0.3)]"
    style={{ width: size, height: size }}
  >
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L14.8 8.5L21.5 9.2L16.5 13.8L18 20.5L12 17L6 20.5L7.5 13.8L2.5 9.2L9.2 8.5L12 2Z"
        stroke="#38bdf8"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="#22d3ee" />
    </svg>
  </div>
);
