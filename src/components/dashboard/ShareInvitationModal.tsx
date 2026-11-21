"use client";

import { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  MessageSquare,
  Mail,
  Send,
  ChevronDown,
} from "lucide-react";
import { ProjectContract } from "@/lib/dashboard-data";

interface ShareInvitationModalProps {
  project: ProjectContract | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareInvitationModal({
  project,
  isOpen,
  onClose,
}: ShareInvitationModalProps) {
  const [copied, setCopied] = useState(false);
  const [emailOptionsOpen, setEmailOptionsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailDraftCopied, setEmailDraftCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const token = project.invitationToken || "inv_demo";
  const inviteUrl = `${origin}/invite/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsappText = encodeURIComponent(
    `Hi! I've created our project proposal for "${project.title}" ($${project.totalBudget.toLocaleString()} USD) on PayZorr. Please review the agreed milestone deliverables and accept the contract here: ${inviteUrl}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappText}`;

  const rawSubject = `Project Proposal: ${project.title} on PayZorr`;
  const rawBody = `Hello,\n\nI have prepared the project proposal for "${project.title}" ($${project.totalBudget.toLocaleString()} USD across ${project.milestones.length} milestones) on PayZorr.\n\nPlease inspect the agreed deliverables and acceptance criteria to activate the contract:\n${inviteUrl}\n\nBest regards,\n${project.initiatedBy === "client" ? project.client.name : project.freelancer.name}`;

  const emailSubject = encodeURIComponent(rawSubject);
  const emailBody = encodeURIComponent(rawBody);

  const toParam = recipientEmail.trim() ? encodeURIComponent(recipientEmail.trim()) : "";
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${toParam ? `&to=${toParam}` : ""}&su=${emailSubject}&body=${emailBody}`;
  const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?${toParam ? `to=${toParam}&` : ""}subject=${emailSubject}&body=${emailBody}`;
  const mailtoUrl = `mailto:${toParam}?subject=${emailSubject}&body=${emailBody}`;

  const handleCopyEmailDraft = () => {
    navigator.clipboard.writeText(`Subject: ${rawSubject}\n\n${rawBody}`);
    setEmailDraftCopied(true);
    setTimeout(() => setEmailDraftCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0D1527] overflow-hidden my-8 flex flex-col transition-all">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-blue-50/50 via-sky-50/40 to-transparent dark:from-blue-950/20 dark:via-sky-950/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0070BA] text-white shadow-md shadow-[#0070BA]/20">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#0070BA] dark:text-sky-400 block">
                Private Proposal Link
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Share Project Invitation
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 text-xs">
          {/* Project Overview Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {project.title}
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                ${project.totalBudget.toLocaleString()} USD
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              {project.description}
            </p>
            <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{project.milestones.length} Milestones</span>
              <span>•</span>
              <span>Deadline: {project.targetDeadline}</span>
            </div>
          </div>

          {/* Invitation URL Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Unique Invitation Link
            </label>
            <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#131C31]">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full px-2 py-1 text-xs text-slate-700 dark:text-slate-200 bg-transparent font-mono focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0070BA] hover:bg-[#005a96] text-white text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Anyone with this secure link can review the proposal. Contract activates only when accepted.
            </p>
          </div>

          {/* Quick Share Buttons */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Send Directly via
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <span>WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => setEmailOptionsOpen((prev) => !prev)}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  emailOptionsOpen
                    ? "border-[#0070BA] bg-blue-100/80 dark:bg-blue-900/40 text-[#0070BA] dark:text-sky-300 font-bold ring-2 ring-[#0070BA]/20"
                    : "border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-800 dark:text-sky-300 font-bold"
                }`}
              >
                <Mail className="h-4 w-4 text-[#0070BA]" />
                <span>Email Invitation</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${emailOptionsOpen ? "rotate-180 text-[#0070BA]" : "text-slate-400"}`} />
              </button>
            </div>

            {/* Email Dispatch Drawer */}
            {emailOptionsOpen && (
              <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-white/5 border border-blue-200/80 dark:border-white/10 space-y-3 mt-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[#0070BA]" />
                    Choose Email Method
                  </span>
                  <button
                    type="button"
                    onClick={() => setEmailOptionsOpen(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                  >
                    Close
                  </button>
                </div>

                {/* Optional Recipient Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    Recipient Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="freelancer@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131C31] text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0070BA]"
                  />
                </div>

                {/* Quick Webmail & Client Options */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={gmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-[#131C31] border border-slate-200 dark:border-white/10 hover:border-[#0070BA] hover:shadow-xs transition-all text-center group"
                  >
                    <span className="text-sm font-bold text-rose-500">M</span>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#0070BA] mt-0.5">Gmail</span>
                    <span className="text-[9px] text-slate-400">Web compose</span>
                  </a>

                  <a
                    href={outlookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-[#131C31] border border-slate-200 dark:border-white/10 hover:border-[#0070BA] hover:shadow-xs transition-all text-center group"
                  >
                    <span className="text-sm font-bold text-blue-500">O</span>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#0070BA] mt-0.5">Outlook</span>
                    <span className="text-[9px] text-slate-400">Web compose</span>
                  </a>

                  <a
                    href={mailtoUrl}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white dark:bg-[#131C31] border border-slate-200 dark:border-white/10 hover:border-[#0070BA] hover:shadow-xs transition-all text-center group"
                  >
                    <Mail className="h-4 w-4 text-slate-600 dark:text-slate-300 group-hover:text-[#0070BA]" />
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#0070BA] mt-0.5">Default App</span>
                    <span className="text-[9px] text-slate-400">Mailto link</span>
                  </a>
                </div>

                {/* Copy Email Text Button */}
                <button
                  type="button"
                  onClick={handleCopyEmailDraft}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white dark:bg-[#131C31] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {emailDraftCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Email Draft Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      <span>Copy Full Email Subject & Message</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Security & Agreement Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-[#0070BA]" />
              <span>Safe Mutual Agreement Process</span>
            </div>
            <p>
              Opening this link does not automatically accept the project. The recipient must authenticate on PayZorr, inspect the agreed milestone criteria, and explicitly click <strong>Accept Proposal</strong> to activate work and escrow.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
