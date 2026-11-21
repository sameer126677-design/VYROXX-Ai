import React from 'react';
import { Shield, FileText, AlertTriangle, ArrowLeft } from 'lucide-react';

interface LegalPageProps {
  page: 'privacy' | 'terms';
  onBack: () => void;
}

export const LegalPageView: React.FC<LegalPageProps> = ({ page, onBack }) => {
  return (
    <div className="min-h-full w-full px-6 sm:px-12 py-8 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs sm:text-sm text-cyan-300 hover:text-cyan-200 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {page === 'privacy' ? (
        <div className="rounded-2xl vyroxx-glass p-7 sm:p-9 border border-cyan-300/25 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-cyan-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                VYROXX Privacy Policy & Data Protection Notice
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Prepared for Indian Digital Personal Data Protection (DPDP) Readiness
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/35 flex items-start gap-3 text-xs text-amber-200 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Compliance Notice:</strong> Technical privacy safeguards, consent
              recording, data export, and deletion controls are implemented in this software.
              However, technical controls alone do not constitute legal compliance. Formal
              review by qualified legal counsel and operational Grievance Officer appointment
              are required prior to commercial launch.
            </div>
          </div>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              1. Personal Data Collected & Purpose
            </h2>
            <p>
              When you create a VYROXX account, we collect your email address, display name,
              unique username, optional profile bio/photo, and your animation prompts,
              project metadata, chat history, and uploaded media assets. Data is processed
              strictly to authenticate your session, persist your creative projects in
              isolated Cloud Firestore storage, and generate structured animation scene
              plans via server-side OpenRouter and CodeCraft AI APIs.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              2. Adult-Only Service & Children’s Data
            </h2>
            <p>
              VYROXX is intended exclusively for adults aged 18 years and older. We do not
              knowingly create accounts for or collect personal data from children under 18.
              Note: Self-attested age confirmation checkboxes during signup are not full legal
              age-verification mechanisms; verifiable parental consent workflows must be
              implemented before ever allowing minors onto the platform.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              3. Consent Management &amp; Tracking Privacy
            </h2>
            <p>
              Optional analytics are disabled by default and remain off unless you explicitly
              enable them in Settings &gt; Privacy &amp; Security. VYROXX implements zero
              hidden keystroke logging, zero hidden session replay, and zero recording of
              passwords, prompts containing sensitive information, or payment details.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              4. Data Principal Rights (Access, Correction, Export &amp; Erasure)
            </h2>
            <p>
              In Settings, you can review and update your profile, inspect your recorded consent
              timestamp, export a complete JSON archive of your account data (profile, projects,
              chats, assets, and job history), withdraw optional consent, or permanently delete
              your account and all associated server files and database records.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              5. Data Retention &amp; Deletion Policy
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-300">
              <li>
                <strong>Active Accounts, Projects, Chats &amp; Assets:</strong> Retained only
                while your account remains active or until you delete individual items.
              </li>
              <li>
                <strong>Trashed Projects:</strong> Held in Trash &amp; Recovery until you restore
                or permanently delete them.
              </li>
              <li>
                <strong>AI Prompts &amp; Request Processing:</strong> Processed in-memory
                server-side for AI scene planning without writing prompt contents to server
                analytics or tracking logs.
              </li>
              <li>
                <strong>Unverified Accounts:</strong> Blocked from workspace, database, and
                storage access until email verification completes.
              </li>
              <li>
                <strong>Account Deletion:</strong> Using Settings &gt; Storage &amp; Data &gt;
                Delete My Account Permanently triggers immediate erasure of your Firebase Auth
                user, Firestore profile, username reservation, projects, chats, jobs, and server
                binary files.
              </li>
            </ul>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              6. Suspected Data Breach Response Process
            </h2>
            <p>
              In the event of a suspected personal data breach: (a) isolate affected tokens
              and server storage endpoints immediately; (b) revoke compromised credentials
              and rotate API secrets; (c) preserve server access logs without exposing PII;
              (d) notify the Data Protection Board of India and affected users without undue
              delay as required by applicable law; and (e) conduct a post-incident root-cause
              remediation audit.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              7. DPDP Act &amp; Rules Commencement Date Review
            </h2>
            <p>
              The Digital Personal Data Protection Act, 2023 received Presidential assent on
              11 August 2023, with provisions brought into force through staggered Central
              Government Gazette notifications alongside the notified DPDP Rules governing
              notice standards, verifiable parental consent, Consent Manager registration,
              breach reporting, and Data Protection Board operations. Operators must confirm
              currently effective commencement dates and statutory deadlines with qualified
              counsel prior to commercial launch.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              8. Payment Security &amp; Free Prototype Status
            </h2>
            <p>
              VYROXX currently operates as a free prototype with no automatic paid subscriptions
              and collects or stores zero payment card details. If paid plans are introduced
              later, billing will use a trusted PCI-DSS compliant payment processor with
              explicit payment authorization, transparent cancellation and refund terms, and
              advance recurring-payment notifications.
            </p>
          </section>
        </div>
      ) : (
        <div className="rounded-2xl vyroxx-glass p-7 sm:p-9 border border-cyan-300/25 space-y-6">
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-cyan-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                VYROXX Terms of Service
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Workspace Usage, Eligibility &amp; AI Generation Terms
              </p>
            </div>
          </div>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">1. Eligibility (18+ Only)</h2>
            <p>
              By registering for VYROXX, you confirm that you are at least 18 years of age
              and legally capable of entering into these terms. Accounts discovered to belong
              to minors without legally compliant verifiable parental consent will be
              terminated and their data erased.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              2. Account Security &amp; Ownership
            </h2>
            <p>
              You are responsible for safeguarding your login credentials and verifying your
              email address. Your projects, prompts, chats, and uploaded assets remain
              isolated to your authenticated Firebase user account.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              3. Acceptable Use &amp; Safe AI Rendering
            </h2>
            <p>
              Prompts are processed server-side into validated, sandboxed 2D vector animation
              plans. Automated rate limits and file signature validations apply to prevent
              abuse. Do not upload unlawful, infringing, or malicious content.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              4. Billing, Subscriptions &amp; Free Prototype Notice
            </h2>
            <p>
              This prototype is free to use with no automatic paid subscriptions or card
              collection. Any future paid subscription tier will require explicit user checkout
              authorization through a trusted payment processor, clear cancellation and refund
              policies, and recurring-billing notices without storing raw card details on VYROXX
              servers.
            </p>
          </section>

          <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">
              5. Service Availability &amp; Legal Review Disclaimer
            </h2>
            <p>
              VYROXX provides AI-assisted animation planning and client-side rendering exports
              on an "as-is" basis. Technical controls implemented in this codebase do not
              substitute for formal legal review; before commercial public launch, the operating
              organization must finalize jurisdiction-specific legal terms, review DPDP
              commencement milestones, and appoint a Data Protection / Grievance Officer.
            </p>
          </section>
        </div>
      )}
    </div>
  );
};
