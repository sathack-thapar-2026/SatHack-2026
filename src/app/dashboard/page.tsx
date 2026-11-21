"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-store";
import { Milestone, ProjectContract } from "@/lib/dashboard-data";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import NotificationDrawer from "@/components/dashboard/NotificationDrawer";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import ProjectsView from "@/components/dashboard/ProjectsView";
import ProjectWorkspace from "@/components/dashboard/ProjectWorkspace";
import MilestonesView from "@/components/dashboard/MilestonesView";
import AIAuditCenter from "@/components/dashboard/AIAuditCenter";
import PaymentsView from "@/components/dashboard/PaymentsView";
import ProjectRequestsView from "@/components/dashboard/ProjectRequestsView";

// Modals
import AuditModal from "@/components/dashboard/AuditModal";
import SubmissionModal from "@/components/dashboard/SubmissionModal";
import RevisionRequestModal from "@/components/dashboard/RevisionRequestModal";
import PaymentModal from "@/components/dashboard/PaymentModal";
import NewProjectModal from "@/components/dashboard/NewProjectModal";
import EditProjectModal from "@/components/dashboard/EditProjectModal";
import ProposalReviewModal from "@/components/dashboard/ProposalReviewModal";
import AddMilestoneModal from "@/components/dashboard/AddMilestoneModal";
import EditMilestoneModal from "@/components/dashboard/EditMilestoneModal";
import UIAlertDialog from "@/components/dashboard/UIAlertDialog";
import InvoiceModal from "@/components/dashboard/InvoiceModal";

import WebThreads from "@/components/WebThreads";
import { CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";

function DashboardInner() {
  const {
    role,
    activeTab,
    setActiveTab,
    activeProject,
    setActiveProjectId,
    toast,
    hideToast,
    alertState,
    authUser,
    isLoaded,
    allProjects,
  } = useDashboard();
  const router = useRouter();

  // Navigation & Drawer states
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [viewingWorkspace, setViewingWorkspaceState] = useState(false);

  // Restore workspace view state on refresh
  useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("milestoneos_workspace_view_v7");
        if (saved === "true") {
          setViewingWorkspaceState(true);
        }
      } catch (_) {}
    }
  });

  const setViewingWorkspace = (val: boolean) => {
    setViewingWorkspaceState(val);
    try {
      localStorage.setItem("milestoneos_workspace_view_v7", val ? "true" : "false");
    } catch (_) {}
  };

  // Modal target states
  const [auditTarget, setAuditTarget] = useState<{
    project: ProjectContract;
    milestone: Milestone;
  } | null>(null);

  const [submissionTarget, setSubmissionTarget] = useState<{
    project: ProjectContract;
    milestone: Milestone;
  } | null>(null);

  const [revisionTarget, setRevisionTarget] = useState<{
    project: ProjectContract;
    milestone: Milestone;
  } | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<{
    project: ProjectContract;
    milestone: Milestone;
  } | null>(null);

  const [invoiceTarget, setInvoiceTarget] = useState<{
    project: ProjectContract;
    milestone: Milestone;
    transactionId?: string;
  } | null>(null);

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingRevisionProject, setEditingRevisionProject] = useState<ProjectContract | null>(null);
  const [reviewingProposalProject, setReviewingProposalProject] = useState<ProjectContract | null>(null);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [editingMilestoneTarget, setEditingMilestoneTarget] = useState<{
    project: ProjectContract;
    milestone: Milestone;
  } | null>(null);

  // Always show the CURRENT project/milestone in a pop-up (looked up by id), never the copy taken when it was opened.
  const resolveLive = <T extends { project: ProjectContract; milestone: Milestone }>(target: T | null): T | null => {
    if (!target) return null;
    const project = allProjects.find((p) => p.id === target.project.id) ?? target.project;
    const milestone = project.milestones.find((m) => m.id === target.milestone.id) ?? target.milestone;
    return { ...target, project, milestone };
  };
  const liveAudit = resolveLive(auditTarget);
  const liveSubmission = resolveLive(submissionTarget);
  const liveRevision = resolveLive(revisionTarget);
  const livePayment = resolveLive(paymentTarget);
  const liveInvoice = resolveLive(invoiceTarget);
  const liveEditingMilestone = resolveLive(editingMilestoneTarget);
  const liveProposal = reviewingProposalProject
    ? allProjects.find((p) => p.id === reviewingProposalProject.id) ?? reviewingProposalProject
    : null;

  // The dashboard only exists for signed-in users: once the sign-in check finishes, send everyone else to /auth.
  useEffect(() => {
    if (isLoaded && !authUser) {
      router.replace("/auth?returnUrl=" + encodeURIComponent("/dashboard"));
    }
  }, [isLoaded, authUser, router]);

  if (isLoaded && !authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFD] dark:bg-[#070B14] text-slate-500 text-xs font-mono">
        Redirecting to sign in...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F8FAFD] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      {/* 
        SUBTLE AMBIENT WEBTHREADS BACKGROUND:
        Calm, quiet background lines that don't compete with readable content
      */}
      <div className="fixed inset-0 z-0 h-screen w-screen overflow-hidden pointer-events-none opacity-20 dark:opacity-15 transition-opacity">
        <WebThreads
          colors={["#0070BA", "#00457C", "#009CDE", "#38BDF8", "#00E599"]}
          coreColor="#FFFFFF"
          lightMode={false}
          threadCount={4}
          speed={0.07}
          frequency={2.8}
          spread={0.2}
          position={0.5}
          glow={0.01}
          brightness={0.55}
          thickness={0.75}
          fade={0.015}
          mouseInteraction={true}
          pulseOnClick={false}
          dpr={1}
        />
      </div>

      {/* SIDEBAR NAVIGATION (Desktop fixed, mobile slide-over) */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenNewProject={() => setIsNewProjectModalOpen(true)}
        onSelectProject={(projectId) => {
          setActiveProjectId(projectId);
          setActiveTab("projects");
          setViewingWorkspace(true);
        }}
      />

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 relative z-10">
        {/* HEADER */}
        <DashboardHeader
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenNewProject={() => setIsNewProjectModalOpen(true)}
        />

        {/* TOAST FEEDBACK NOTIFICATION */}
        {toast && (
          <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md rounded-2xl border border-blue-200 bg-white/95 p-4 text-xs shadow-xl backdrop-blur-md dark:border-blue-900/40 dark:bg-[#0D1527]/95 text-slate-900 dark:text-white animate-in slide-in-from-top-4 duration-300 flex items-start gap-3">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-xl text-white shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-500"
                  : toast.type === "warning"
                  ? "bg-amber-500"
                  : "bg-[#0070BA]"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : toast.type === "warning" ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1">
              <span className="font-bold block text-slate-900 dark:text-white">
                PayZorr Update
              </span>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={hideToast}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <main className="flex-1 px-4 sm:px-8 py-8 max-w-6xl mx-auto w-full">
          {/* TAB 1: Dashboard (Overview) */}
          {(activeTab === "dashboard" || activeTab === "overview") && (
            <DashboardOverview
              onOpenAudit={(p, m) => setAuditTarget({ project: p, milestone: m })}
              onOpenSubmission={(p, m) => setSubmissionTarget({ project: p, milestone: m })}
              onOpenPayment={(p, m) => setPaymentTarget({ project: p, milestone: m })}
              onOpenInvoice={(p, m, tx) => setInvoiceTarget({ project: p, milestone: m, transactionId: tx })}
              onOpenNewProject={() => {
                setEditingRevisionProject(null);
                setIsNewProjectModalOpen(true);
              }}
              onSelectProject={(projectId) => {
                setActiveProjectId(projectId);
                setActiveTab("projects");
                setViewingWorkspace(true);
              }}
              onNavigateToProjects={() => {
                setViewingWorkspace(false);
                setActiveTab("projects");
              }}
              onReviewProposal={(proj) => setReviewingProposalProject(proj)}
              onOpenRevision={(proj) => {
                setEditingRevisionProject(proj);
                setIsNewProjectModalOpen(true);
              }}
            />
          )}

          {/* TAB: Project Requests (Dedicated Section) */}
          {activeTab === "project-requests" && (
            <ProjectRequestsView
              onOpenNewProject={() => {
                setEditingRevisionProject(null);
                setIsNewProjectModalOpen(true);
              }}
              onOpenRevision={(proj) => {
                setEditingRevisionProject(proj);
                setIsNewProjectModalOpen(true);
              }}
              onSelectProject={(projectId) => {
                setActiveProjectId(projectId);
                setActiveTab("projects");
                setViewingWorkspace(true);
              }}
            />
          )}

          {/* TAB 2: My Projects / Workspace */}
          {activeTab === "projects" && (
            <>
              {viewingWorkspace ? (
                <ProjectWorkspace
                  onBackToProjects={() => setViewingWorkspace(false)}
                  onOpenAudit={(p, m) => setAuditTarget({ project: p, milestone: m })}
                  onOpenSubmission={(p, m) => setSubmissionTarget({ project: p, milestone: m })}
                  onOpenRevision={(p, m) => setRevisionTarget({ project: p, milestone: m })}
                  onOpenPayment={(p, m) => setPaymentTarget({ project: p, milestone: m })}
                  onOpenInvoice={(p, m, tx) => setInvoiceTarget({ project: p, milestone: m, transactionId: tx })}
                  onOpenEditProject={() => setIsEditProjectModalOpen(true)}
                  onOpenAddMilestone={() => setIsAddMilestoneOpen(true)}
                  onOpenEditMilestone={(m) => {
                    if (activeProject) {
                      setEditingMilestoneTarget({ project: activeProject, milestone: m });
                    }
                  }}
                />
              ) : (
                <ProjectsView
                  onOpenNewProject={() => setIsNewProjectModalOpen(true)}
                  onSelectProject={(projectId) => {
                    setActiveProjectId(projectId);
                    setViewingWorkspace(true);
                  }}
                  onOpenInvoice={(p, m, tx) => setInvoiceTarget({ project: p, milestone: m, transactionId: tx })}
                />
              )}
            </>
          )}

          {/* TAB 3: Milestones */}
          {activeTab === "milestones" && (
            <MilestonesView
              onOpenAudit={(p, m) => setAuditTarget({ project: p, milestone: m })}
              onOpenSubmission={(p, m) => setSubmissionTarget({ project: p, milestone: m })}
              onOpenPayment={(p, m) => setPaymentTarget({ project: p, milestone: m })}
              onOpenRevision={(p, m) => setRevisionTarget({ project: p, milestone: m })}
              onOpenInvoice={(p, m, tx) => setInvoiceTarget({ project: p, milestone: m, transactionId: tx })}
              onSelectProject={(projectId) => {
                setActiveProjectId(projectId);
                setActiveTab("projects");
                setViewingWorkspace(true);
              }}
            />
          )}

          {/* TAB 4: Work Review */}
          {(activeTab === "work-review" || activeTab === "ai-audits") && (
            <AIAuditCenter
              onOpenAudit={(p, m) => setAuditTarget({ project: p, milestone: m })}
              onSelectProject={(projectId) => {
                setActiveProjectId(projectId);
                setActiveTab("projects");
                setViewingWorkspace(true);
              }}
            />
          )}

          {/* TAB 5: Payments */}
          {activeTab === "payments" && (
            <PaymentsView
              onOpenPayment={(p, m) => setPaymentTarget({ project: p, milestone: m })}
              onOpenInvoice={(p, m, tx) => setInvoiceTarget({ project: p, milestone: m, transactionId: tx })}
            />
          )}
        </main>

        {/* FOOTER */}
        <footer className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-white/10 bg-white/40 dark:bg-transparent backdrop-blur-xs">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Simple Milestone Payments
            </span>
            <span className="text-slate-400">
              Milestone Escrow & Protected Settlements
            </span>
          </div>
        </footer>
      </div>

      {/* NOTIFICATION DRAWER */}
      <NotificationDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onOpenProposal={(p) => setReviewingProposalProject(p)}
        onSelectProject={(projectId) => {
          setActiveProjectId(projectId);
          setActiveTab("projects");
          setViewingWorkspace(true);
        }}
      />

      {/* AUDIT / INSPECTION MODAL */}
      {liveAudit && (
        <AuditModal
          project={liveAudit.project}
          milestone={liveAudit.milestone}
          isOpen={true}
          onClose={() => setAuditTarget(null)}
          onOpenRevisionModal={() => {
            const t = liveAudit;
            setAuditTarget(null);
            setRevisionTarget(t);
          }}
          onOpenPaymentModal={() => {
            const t = liveAudit;
            setAuditTarget(null);
            setPaymentTarget(t);
          }}
          onOpenSubmissionModal={() => {
            const t = liveAudit;
            setAuditTarget(null);
            setSubmissionTarget(t);
          }}
        />
      )}

      {/* SUBMISSION MODAL */}
      {liveSubmission && (
        <SubmissionModal
          project={liveSubmission.project}
          milestone={liveSubmission.milestone}
          isOpen={true}
          onClose={() => setSubmissionTarget(null)}
        />
      )}

      {/* REVISION REQUEST MODAL */}
      {liveRevision && (
        <RevisionRequestModal
          project={liveRevision.project}
          milestone={liveRevision.milestone}
          isOpen={true}
          onClose={() => setRevisionTarget(null)}
        />
      )}

      {/* PAYMENT MODAL */}
      {livePayment && (
        <PaymentModal
          project={livePayment.project}
          milestone={livePayment.milestone}
          isOpen={true}
          onClose={() => setPaymentTarget(null)}
          onOpenInvoice={(p, m, tx) => setInvoiceTarget({ project: p, milestone: m, transactionId: tx })}
        />
      )}

      {/* INVOICE MODAL */}
      {liveInvoice && (
        <InvoiceModal
          project={liveInvoice.project}
          milestone={liveInvoice.milestone}
          transactionId={liveInvoice.transactionId}
          isOpen={true}
          onClose={() => setInvoiceTarget(null)}
        />
      )}

      {/* CREATE NEW PROJECT MODAL */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        initialProject={editingRevisionProject}
        onClose={() => {
          setIsNewProjectModalOpen(false);
          setEditingRevisionProject(null);
        }}
      />

      {/* EDIT PROJECT MODAL */}
      {activeProject && (
        <EditProjectModal
          project={activeProject}
          isOpen={isEditProjectModalOpen}
          onClose={() => setIsEditProjectModalOpen(false)}
        />
      )}

      {/* PROPOSAL REVIEW MODAL */}
      <ProposalReviewModal
        project={liveProposal}
        isOpen={!!reviewingProposalProject}
        onClose={() => setReviewingProposalProject(null)}
        onOpenRevision={(proj) => {
          setReviewingProposalProject(null);
          setEditingRevisionProject(proj);
          setIsNewProjectModalOpen(true);
        }}
      />

      {/* ADD MILESTONE MODAL */}
      {activeProject && (
        <AddMilestoneModal
          project={activeProject}
          isOpen={isAddMilestoneOpen}
          onClose={() => setIsAddMilestoneOpen(false)}
        />
      )}

      {/* EDIT MILESTONE MODAL */}
      {liveEditingMilestone && (
        <EditMilestoneModal
          project={liveEditingMilestone.project}
          milestone={liveEditingMilestone.milestone}
          isOpen={true}
          onClose={() => setEditingMilestoneTarget(null)}
        />
      )}

      {/* GLOBAL UI ALERT & CONFIRM DIALOG */}
      {alertState && (
        <UIAlertDialog
          isOpen={alertState.isOpen}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
          confirmText={alertState.confirmText}
          cancelText={alertState.cancelText}
          isConfirm={alertState.isConfirm}
          isDestructive={alertState.isDestructive}
          onConfirm={alertState.onConfirm || (() => {})}
          onCancel={alertState.onCancel}
        />
      )}
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const initialRole = roleParam === "freelancer" ? "freelancer" : roleParam === "client" ? "client" : undefined;

  return (
    <DashboardProvider initialRole={initialRole}>
      <DashboardInner />
    </DashboardProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFD] dark:bg-[#070B14] text-slate-500 text-xs font-mono">
          Loading PayZorr...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
