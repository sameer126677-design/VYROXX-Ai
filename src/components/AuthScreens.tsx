import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  MailCheck,
  ArrowLeft,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { AuthView } from '../types';
import { VyroxxVLogo } from './BrandLogo';
import { LegalPageView } from './LegalPages';

import { deleteUser } from 'firebase/auth';

interface AuthScreensProps {
  authView: AuthView;
  setAuthView: (view: AuthView) => void;
  unverifiedUserEmail?: string | null;
  onRefreshVerification: () => Promise<void>;
  onSignupMetadataReady: (meta: {
    displayName: string;
    username: string;
    ageConfirmed18Plus: boolean;
    optionalAnalytics: boolean;
  }) => void;
  onCompleteAgeConsent?: (meta: {
    ageConfirmed18Plus: boolean;
    optionalAnalytics: boolean;
  }) => Promise<void>;
}

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters with letters and numbers.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing authentication.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in your Firebase Console (Authentication > Sign-in method > Email/Password). You can enable it there or use Google Login.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

export const AuthScreens: React.FC<AuthScreensProps> = ({
  authView,
  setAuthView,
  unverifiedUserEmail,
  onRefreshVerification,
  onSignupMetadataReady,
  onCompleteAgeConsent,
}) => {
  const [legalOverlay, setLegalOverlay] = useState<'privacy' | 'terms' | null>(null);

  // Login form state (clean empty inputs — no hardcoded account)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [optionalAnalytics, setOptionalAnalytics] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Email Verification state
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Age & DPDP Consent Onboarding Gate state (for first-time Google / post-verification login)
  const [gateAgeConfirmed, setGateAgeConfirmed] = useState(false);
  const [gateTermsAccepted, setGateTermsAccepted] = useState(false);
  const [gateOptionalAnalytics, setGateOptionalAnalytics] = useState(false);
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [under18Notice, setUnder18Notice] = useState(false);

  if (legalOverlay) {
    return (
      <div className="min-h-screen w-full vyroxx-bg py-8 overflow-y-auto">
        <LegalPageView page={legalOverlay} onBack={() => setLegalOverlay(null)} />
      </div>
    );
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !confirmPassword) {
      setSignupError('Please complete all required fields.');
      return;
    }

    const cleanSlug = username.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9_.]{2,40}$/.test(cleanSlug)) {
      setSignupError('Username must be 2–40 characters using letters, numbers, underscores, or dots.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setSignupError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setSignupError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    if (!ageConfirmed) {
      setSignupError('VYROXX is strictly for users aged 18 and older. You must confirm your eligibility.');
      return;
    }

    if (!termsAccepted) {
      setSignupError('Please review and accept the Privacy Policy and Terms of Service.');
      return;
    }

    setSignupLoading(true);
    try {
      onSignupMetadataReady({
        displayName: fullName.trim(),
        username: cleanSlug,
        ageConfirmed18Plus: true,
        optionalAnalytics,
      });

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });
      await sendEmailVerification(cred.user);
      setVerifyMessage('Verification email sent! Please check your inbox and spam folder.');
      setAuthView('verify-email');
    } catch (err) {
      setSignupError(mapFirebaseAuthError(err));
    } finally {
      setSignupLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setVerifyError(null);
    setVerifyMessage(null);
    setVerifyLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerifyMessage('A fresh verification link has been sent to your email address.');
    } catch (err) {
      setVerifyError(mapFirebaseAuthError(err));
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerifyError(null);
    setVerifyMessage(null);
    setVerifyLoading(true);
    try {
      await onRefreshVerification();
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        setVerifyError('Your email is still unverified. Click the link in your inbox first, then refresh.');
      }
    } catch (err) {
      setVerifyError(mapFirebaseAuthError(err));
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email address and password.');
      return;
    }

    setLoginLoading(true);
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      if (!cred.user.emailVerified) {
        setAuthView('verify-email');
      }
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setGoogleLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLoginError(mapFirebaseAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resetEmail.trim() || !emailRegex.test(resetEmail.trim())) {
      setResetError('Please enter a valid email address.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      setResetError(mapFirebaseAuthError(err));
    } finally {
      setResetLoading(false);
    }
  };

  // 1. WELCOME SCREEN
  if (authView === 'welcome') {
    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-blue-600/15 blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full bg-cyan-500/15 blur-[130px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
          <VyroxxVLogo size={96} className="mb-6" />

          <h1
            className="text-5xl sm:text-7xl font-bold tracking-[0.22em] vyroxx-heading-metallic uppercase mb-4 select-none"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            VYROXX
          </h1>

          <p className="text-lg sm:text-2xl text-slate-300/85 font-light tracking-wide mb-11">
            The Ultimate AI Creation Workspace
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setAuthView('signup')}
              className="px-9 py-3.5 rounded-full text-sm sm:text-base font-medium text-white bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300 shadow-[0_0_28px_rgba(56,189,248,0.45)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              Get Started
            </button>

            <button
              type="button"
              onClick={() => setAuthView('login')}
              className="px-10 py-3.5 rounded-full text-sm sm:text-base font-medium text-slate-200 bg-slate-900/75 hover:bg-slate-800/85 border border-slate-400/30 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              Login
            </button>
          </div>

          <div className="mt-10 flex items-center gap-4 text-xs text-slate-400">
            <span>Adults 18+ Only</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => setLegalOverlay('privacy')}
              className="hover:text-cyan-300 underline-offset-4 hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setLegalOverlay('terms')}
              className="hover:text-cyan-300 underline-offset-4 hover:underline cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. SIGNUP SCREEN
  if (authView === 'signup') {
    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
        <div className="w-full max-w-[420px] flex flex-col items-center relative z-10">
          <button
            type="button"
            onClick={() => setAuthView('welcome')}
            className="mb-3 hover:scale-105 transition-transform cursor-pointer"
            title="Return to Welcome"
          >
            <VyroxxVLogo size={54} />
          </button>

          <h1 className="text-2xl sm:text-3xl font-normal text-slate-100 tracking-wide mb-6">
            Create an Account
          </h1>

          <form onSubmit={handleSignupSubmit} className="w-full space-y-3" noValidate>
            {signupError && (
              <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{signupError}</span>
              </div>
            )}

            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={signupLoading}
              className="w-full px-4 py-3 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
            />

            <input
              type="text"
              placeholder="Username (e.g. alex_studio)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={signupLoading}
              className="w-full px-4 py-3 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={signupLoading}
              className="w-full px-4 py-3 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
            />

            <div className="relative">
              <input
                type={showSignupPassword ? 'text' : 'password'}
                placeholder="Password (min. 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={signupLoading}
                className="w-full px-4 py-3 pr-10 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={signupLoading}
                className="w-full px-4 py-3 pr-10 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Adult-Only & Consent Checkboxes (No DOB Collected) */}
            <div className="pt-1 space-y-2.5 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-slate-900/75 border border-cyan-500/20 text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-cyan-300">Minimum Age 18+:</strong> VYROXX does not collect
                date-of-birth details. Self-attestation is an initial eligibility gate and is not a
                substitute for full legal age verification; minors cannot be onboarded without
                applicable verifiable parental consent.
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => {
                    setAgeConfirmed(e.target.checked);
                    if (e.target.checked) setUnder18Notice(false);
                  }}
                  className="mt-0.5 rounded accent-cyan-400"
                />
                <span>
                  I confirm that I am at least <strong>18 years of age</strong>.
                </span>
              </label>

              {under18Notice && (
                <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] leading-relaxed">
                  Users under 18 cannot create a VYROXX account. Onboarding minors requires legally
                  mandated verifiable parental consent, which is not enabled in this 18+ workspace.
                </div>
              )}

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setAgeConfirmed(false);
                    setUnder18Notice(true);
                  }}
                  className="text-[11px] text-slate-400 hover:text-amber-300 underline-offset-4 hover:underline cursor-pointer"
                >
                  I am under 18
                </button>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded accent-cyan-400"
                />
                <span>
                  I consent to essential account data processing and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setLegalOverlay('privacy')}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalOverlay('terms')}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    Terms of Service
                  </button>
                  .
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-slate-400">
                <input
                  type="checkbox"
                  checked={optionalAnalytics}
                  onChange={(e) => setOptionalAnalytics(e.target.checked)}
                  className="mt-0.5 rounded accent-cyan-400"
                />
                <span>
                  Optional: Allow anonymous workspace crash &amp; feature usage metrics (off
                  by default).
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={signupLoading}
                className="w-full py-3 rounded-lg vyroxx-btn-primary text-sm font-semibold tracking-wide cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {signupLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{signupLoading ? 'Creating Account...' : 'Create Account'}</span>
              </button>
            </div>
          </form>

          <p className="mt-5 text-xs text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setAuthView('login')}
              className="text-cyan-400 hover:text-cyan-300 font-medium underline-offset-4 hover:underline cursor-pointer"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    );
  }

  // 3. EMAIL VERIFICATION SCREEN (Real Firebase Email Verification Gate)
  if (authView === 'verify-email') {
    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px] vyroxx-glass rounded-2xl p-8 text-center relative">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
            <MailCheck className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-medium text-white mb-2">Verify Your Email</h2>
          <p className="text-sm text-slate-300/85 mb-5 leading-relaxed">
            A real verification link has been dispatched to{' '}
            <span className="text-cyan-300 font-medium">
              {unverifiedUserEmail || auth.currentUser?.email || email || 'your inbox'}
            </span>
            . Please click the verification link in that email before entering VYROXX.
          </p>

          {verifyMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{verifyMessage}</span>
            </div>
          )}

          {verifyError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              disabled={verifyLoading}
              onClick={handleCheckVerification}
              className="w-full py-3 rounded-lg vyroxx-btn-primary text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${verifyLoading ? 'animate-spin' : ''}`} />
              <span>I Have Verified My Email — Continue</span>
            </button>

            <button
              type="button"
              disabled={verifyLoading}
              onClick={handleResendVerification}
              className="w-full py-2.5 rounded-lg bg-slate-800/75 hover:bg-slate-800 text-xs font-medium text-slate-200 border border-slate-600/40 transition-colors cursor-pointer disabled:opacity-60"
            >
              Resend Verification Email
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut(auth).catch(() => {});
              setAuthView('login');
            }}
            className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sign Out &amp; Return to Login</span>
          </button>
        </div>
      </div>
    );
  }

  // 3B. AGE & DPDP CONSENT ONBOARDING GATE (First-Time Google Sign-In / Post-Verification)
  if (authView === 'age-consent') {
    const handleGateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setGateError('');
      if (!gateAgeConfirmed) {
        setGateError('VYROXX is strictly for users aged 18 and older.');
        return;
      }
      if (!gateTermsAccepted) {
        setGateError('Please review and consent to the Privacy Policy and Terms of Service.');
        return;
      }
      if (!onCompleteAgeConsent) return;
      setGateLoading(true);
      try {
        await onCompleteAgeConsent({
          ageConfirmed18Plus: true,
          optionalAnalytics: gateOptionalAnalytics,
        });
      } catch (err) {
        setGateError(
          err instanceof Error ? err.message : 'Unable to finalize account onboarding.'
        );
      } finally {
        setGateLoading(false);
      }
    };

    const handleUnder18Decline = async () => {
      setGateLoading(true);
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser).catch(async () => {
            await signOut(auth).catch(() => {});
          });
        }
        setAuthView('welcome');
      } finally {
        setGateLoading(false);
      }
    };

    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[460px] vyroxx-glass rounded-2xl p-7 sm:p-8 border border-cyan-400/30">
          <div className="flex flex-col items-center text-center mb-5">
            <VyroxxVLogo size={48} className="mb-3" />
            <h2 className="text-2xl font-medium text-white">
              Eligibility &amp; Privacy Consent
            </h2>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Before creating your workspace profile for{' '}
              <span className="text-cyan-300 font-medium">
                {unverifiedUserEmail || auth.currentUser?.email || 'your account'}
              </span>
              , confirm eligibility and data preferences below.
            </p>
          </div>

          <div className="mb-4 p-3 rounded-xl bg-slate-900/75 border border-cyan-500/20 text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-cyan-300">Adults 18+ Only (No DOB Collected):</strong>{' '}
            This self-attestation confirms minimum age eligibility and is not a legal age
            verification mechanism. Users under 18 may not proceed without verifiable parental
            consent.
          </div>

          {gateError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleGateSubmit} className="space-y-3 text-xs text-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={gateAgeConfirmed}
                onChange={(e) => setGateAgeConfirmed(e.target.checked)}
                className="mt-0.5 rounded accent-cyan-400"
              />
              <span>
                I confirm that I am at least <strong>18 years of age</strong>.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={gateTermsAccepted}
                onChange={(e) => setGateTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded accent-cyan-400"
              />
              <span>
                I consent to essential account storage and AI scene processing under the{' '}
                <button
                  type="button"
                  onClick={() => setLegalOverlay('privacy')}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Privacy Policy
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setLegalOverlay('terms')}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Terms of Service
                </button>
                .
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-400">
              <input
                type="checkbox"
                checked={gateOptionalAnalytics}
                onChange={(e) => setGateOptionalAnalytics(e.target.checked)}
                className="mt-0.5 rounded accent-cyan-400"
              />
              <span>
                Optional: Allow anonymous workspace crash &amp; feature usage metrics (off by
                default).
              </span>
            </label>

            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={gateLoading}
                className="w-full py-3 rounded-lg vyroxx-btn-primary text-sm font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {gateLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm &amp; Enter VYROXX</span>
              </button>

              <button
                type="button"
                disabled={gateLoading}
                onClick={handleUnder18Decline}
                className="w-full py-2.5 rounded-lg bg-slate-900/80 hover:bg-rose-950/45 border border-rose-500/35 text-xs text-rose-300 cursor-pointer"
              >
                I am under 18 — Cancel &amp; Remove Session
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 4. FORGOT PASSWORD SCREEN
  if (authView === 'forgot-password') {
    return (
      <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px] vyroxx-glass rounded-2xl p-8 flex flex-col items-center">
          <VyroxxVLogo size={48} className="mb-3" />
          <h2 className="text-2xl font-normal text-white mb-2">Reset Password</h2>
          <p className="text-xs text-slate-400 text-center mb-6">
            Enter your registered email address and Firebase will send a password reset link.
          </p>

          {resetSent ? (
            <div className="w-full space-y-4 text-center">
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs leading-relaxed">
                Password reset instructions have been sent to{' '}
                <span className="font-semibold text-white">{resetEmail}</span>.
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setAuthView('login');
                }}
                className="w-full py-3 rounded-lg vyroxx-btn-primary text-sm font-semibold cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="w-full space-y-4" noValidate>
              {resetError && (
                <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs">
                  {resetError}
                </div>
              )}
              <input
                type="email"
                placeholder="Enter your email address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetLoading}
                className="w-full px-4 py-3 rounded-lg vyroxx-input text-sm placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 rounded-lg vyroxx-btn-primary text-sm font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Send Reset Link</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 5. LOGIN SCREEN
  return (
    <div className="min-h-screen w-full vyroxx-bg flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="w-full max-w-[400px] vyroxx-glass rounded-2xl p-7 sm:p-8 flex flex-col items-center shadow-[0_0_45px_rgba(34,211,238,0.18)] border border-cyan-400/25">
        <button
          type="button"
          onClick={() => setAuthView('welcome')}
          className="mb-3 hover:scale-105 transition-transform cursor-pointer"
          title="Back to Welcome"
        >
          <VyroxxVLogo size={52} />
        </button>

        <h1 className="text-2xl sm:text-3xl font-normal text-slate-100 mb-6">Welcome Back</h1>

        <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5" noValidate>
          {loginError && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            disabled={loginLoading || googleLoading}
            className="w-full px-4 py-3 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
          />

          <div className="relative">
            <input
              type={showLoginPassword ? 'text' : 'password'}
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={loginLoading || googleLoading}
              className="w-full px-4 py-3 pr-10 rounded-lg vyroxx-input text-sm placeholder:text-slate-400/80"
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5 pb-1">
            <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-0"
              />
              <span>Remember Me</span>
            </label>

            <button
              type="button"
              onClick={() => setAuthView('forgot-password')}
              className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loginLoading || googleLoading}
            className="w-full py-3 rounded-lg vyroxx-btn-primary text-sm font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loginLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loginLoading ? 'Signing In...' : 'Login'}</span>
          </button>
        </form>

        <div className="w-full flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-slate-700/60" />
          <span className="text-xs text-slate-400">or continue with</span>
          <div className="h-px flex-1 bg-slate-700/60" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loginLoading || googleLoading}
          className="w-full py-3 rounded-lg vyroxx-input hover:border-slate-400/50 flex items-center justify-center gap-2.5 text-sm font-medium text-slate-200 transition-all cursor-pointer disabled:opacity-60"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span className="font-bold text-base text-slate-300">G</span>
          )}
          <span>{googleLoading ? 'Connecting Google Account...' : 'Google Login'}</span>
        </button>

        <p className="mt-5 text-xs text-slate-400">
          New here?{' '}
          <button
            type="button"
            onClick={() => setAuthView('signup')}
            className="text-cyan-400 hover:text-cyan-300 font-medium hover:underline cursor-pointer"
          >
            Create Account
          </button>
        </p>

        <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => setLegalOverlay('privacy')}
            className="hover:text-cyan-300 cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setLegalOverlay('terms')}
            className="hover:text-cyan-300 cursor-pointer"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
};
