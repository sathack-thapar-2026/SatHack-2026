"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from "react";
import {
  ProjectContract,
  Milestone,
  MilestoneStatus,
  TransactionRecord,
  NotificationItem,
  AIAssessment,
  MilestoneSubmission,
  ActivityItem,
  DeliverableLink,
  DeliverableAttachment,
  MilestoneOSUser,
  generateMilestoneOSId,
  generateBaseCode,
  extractBaseCode,
  formatClientId,
  formatFreelancerId,
  generateInvitationToken,
  isProjectCompleted,
  isProjectAccepted,
  formatCurrency,
  getCurrencySymbol,
  roundMoney,
} from "./dashboard-data";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { authFetch } from "./api-client";

export type DashboardTab =
  | "dashboard"
  | "projects"
  | "project-requests"
  | "milestones"
  | "work-review"
  | "payments"
  // Legacy aliases
  | "overview"
  | "ai-audits";

export interface UserProfiles {
  client: {
    id: string;
    baseCode?: string;
    clientId?: string;
    freelancerId?: string;
    milestoneOSId: string;
    name: string;
    email: string;
    avatar: string;
    company: string;
  };
  freelancer: {
    id: string;
    baseCode?: string;
    clientId?: string;
    freelancerId?: string;
    milestoneOSId: string;
    name: string;
    email: string;
    avatar: string;
    title: string;
    rating: number;
  };
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  baseCode: string;
  clientId: string;
  freelancerId: string;
  milestoneOSId: string;
  company?: string;
  title?: string;
  role: "client" | "freelancer" | "both";
  roles: string[];
}

/** Uploaded files are stored as base64 data URLs; keep them out of localStorage (it has a ~5 MB limit). */
function slimProjectsForCache(projects: ProjectContract[]): ProjectContract[] {
  return projects.map((p) => ({
    ...p,
    milestones: (p.milestones || []).map((m) => ({
      ...m,
      submissions: (m.submissions || []).map((sub) => ({
        ...sub,
        attachments: (sub.attachments || []).map((a) => ({
          ...a,
          dataUrl: undefined,
          url: a.url && a.url.startsWith("data:") ? undefined : a.url,
        })),
      })),
    })),
  }));
}

export interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  confirmText?: string;
  cancelText?: string;
  isConfirm?: boolean;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DashboardContextType {
  role: "client" | "freelancer";
  setRole: (role: "client" | "freelancer") => void;
  userProfiles: UserProfiles;
  updateUserProfile: (
    role: "client" | "freelancer" | "both",
    data: Partial<{ name: string; email: string; company?: string; title?: string }>
  ) => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  projects: ProjectContract[];
  allProjects: ProjectContract[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeProject: ProjectContract | undefined;
  transactions: TransactionRecord[];
  notifications: NotificationItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  toast: { message: string; type: "success" | "info" | "warning" } | null;
  showToast: (message: string, type?: "success" | "info" | "warning") => void;
  hideToast: () => void;
  alertState: AlertState | null;
  showAlert: (options: {
    title?: string;
    message: string;
    type?: "info" | "warning" | "error" | "success";
    confirmText?: string;
    onConfirm?: () => void;
  }) => void;
  showConfirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => void;
  closeAlert: () => void;

  // Multi-user & Demo Isolation
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  exitDemoMode: () => void;
  enterDemoMode: (demoRole?: "client" | "freelancer") => void;
  authUser: AuthenticatedUser | null;
  /** True once the first sign-in check / data load has finished. */
  isLoaded: boolean;
  refreshProjects: () => Promise<void>;

  // Actions
  createProject: (
    newProject: Omit<
      ProjectContract,
      "id" | "createdAt" | "totalPaid" | "escrowFunded" | "escrowReleased" | "activityLog"
    >,
    asDraft?: boolean
  ) => string;
  updateProject: (projectId: string, updates: Partial<ProjectContract>) => void;
  archiveProject: (projectId: string) => void;
  acceptProposal: (projectId: string) => void;
  requestProposalChanges: (projectId: string, feedback: string) => void;
  rejectProposal: (projectId: string, reason?: string) => void;
  resubmitProposal: (projectId: string, updatedData: Partial<ProjectContract>) => void | Promise<void>;
  revokeInvitation: (projectId: string) => void;
  acceptInvitationByToken: (
    token: string
  ) => Promise<{ success: boolean; project?: ProjectContract; error?: string }>;
  addMilestone: (
    projectId: string,
    data: {
      title: string;
      description?: string;
      amount: number;
      currency?: string;
      dueDate?: string;
      acceptanceCriteria?: string[];
    }
  ) => void;
  editMilestone: (
    projectId: string,
    milestoneId: string,
    updates: {
      title?: string;
      description?: string;
      amount?: number;
      dueDate?: string;
    }
  ) => void;
  startMilestoneWork: (projectId: string, milestoneId: string) => void;
  submitMilestoneDeliverables: (
    projectId: string,
    milestoneId: string,
    deliverables: {
      demoUrl?: string;
      githubRepo?: string;
      githubPr?: string;
      loomVideo?: string;
      notes: string;
      deliverableLinks?: DeliverableLink[];
      attachments?: DeliverableAttachment[];
    },
    isRevision?: boolean
  ) => void | Promise<void>;
  requestRevision: (projectId: string, milestoneId: string, reason: string) => void;
  requestChanges: (projectId: string, milestoneId: string, reason: string) => void;
  approveMilestone: (projectId: string, milestoneId: string) => Promise<boolean>;
  setMilestoneAudit: (projectId: string, milestoneId: string, audit: AIAssessment) => void;
  releasePayment: (projectId: string, milestoneId: string, verifiedCaptureId: string) => string;
  makePayment: (projectId: string, milestoneId: string, verifiedCaptureId: string, timestamp?: string) => string;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  resetToFactoryDefaults: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACTIVE_TAB: "milestoneos_tab_v8",
  STATUS_FILTER: "milestoneos_status_filter_v8",
  ROLE: "milestoneos_role_v8",
  ACTIVE_PROJECT: "milestoneos_active_proj_v8",
  ACTIVE_USER: "milestoneos_active_user_v8",
  DEMO_MODE: "milestoneos_demo_mode",
};

export function DashboardProvider({
  children,
  initialRole = "client",
  isDemoFromUrl = false,
}: {
  children: ReactNode;
  initialRole?: "client" | "freelancer";
  isDemoFromUrl?: boolean;
}) {
  const [role, setRoleState] = useState<"client" | "freelancer">(initialRole || "client");
  const [activeTab, setActiveTabState] = useState<DashboardTab>("dashboard");
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null);

  // Raw list of projects authorized for this session (demo or user)
  const [rawProjects, setRawProjects] = useState<ProjectContract[]>([]);
  const [activeProjectIdState, setActiveProjectIdState] = useState<string>("");
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilterState] = useState<string>("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "warning" } | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Always-current copy of the signed-in user, so timers/focus handlers never use a stale identity.
  const authUserRef = useRef<AuthenticatedUser | null>(null);
  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  // Background-sync bookkeeping (refs, so timers and handlers always see the current values).
  const syncRef = useRef({
    inFlight: null as Promise<void> | null, // a sync is running: never start a second one on top of it
    rerun: false, // a forced refresh was requested while one was running
    mutations: 0, // actions currently being saved: don't overwrite the screen with older server data meanwhile
    version: "", // last project-list version we applied
    notificationsAt: 0,
    failures: 0,
  });
  const actionLocks = useRef(new Set<string>());
  const creatingRef = useRef(false);
  const lastCreatedIdRef = useRef("");

  /** Like authFetch, but counted as "an action is being saved" so background syncs wait for it. */
  const mutFetch = (input: string, init?: RequestInit): Promise<Response> => {
    syncRef.current.mutations++;
    return authFetch(input, init).finally(() => {
      syncRef.current.mutations = Math.max(0, syncRef.current.mutations - 1);
    });
  };

  /** Runs `fn` unless the same action (same key) is still being saved, so repeated clicks do not repeat the action. */
  const runOnce = async <T,>(key: string, fn: () => T | Promise<T>, whenBusy: T): Promise<T> => {
    if (actionLocks.current.has(key)) return whenBusy;
    actionLocks.current.add(key);
    try {
      return await fn();
    } finally {
      actionLocks.current.delete(key);
    }
  };

  // Derive active perspective user profiles
  const userProfiles: UserProfiles = useMemo(() => {
    // Signed-out visitors get neutral placeholders; nobody else's identity is ever assumed.
    const currentName = authUser?.name || "Guest";
    const currentEmail = authUser?.email || "";
    const currentAvatar = authUser?.avatar || "GU";
    const baseCode = authUser?.baseCode || extractBaseCode(authUser?.milestoneOSId) || "";
    const clientId = authUser?.clientId || (baseCode ? formatClientId(baseCode) : "");
    const freelancerId = authUser?.freelancerId || (baseCode ? formatFreelancerId(baseCode) : "");
    const currentId = authUser?.id || "";

    return {
      client: {
        id: currentId,
        baseCode,
        clientId,
        freelancerId,
        milestoneOSId: clientId,
        name: currentName,
        email: currentEmail,
        avatar: currentAvatar,
        company: authUser?.company || "Client",
      },
      freelancer: {
        id: currentId,
        baseCode,
        clientId,
        freelancerId,
        milestoneOSId: freelancerId,
        name: currentName,
        email: currentEmail,
        avatar: currentAvatar,
        title: authUser?.title || "Freelancer",
        rating: 5.0,
      },
    };
  }, [authUser]);

  // Derive perspective-scoped projects based on active role
  const projects: ProjectContract[] = useMemo(() => {
    // No signed-in user means no projects. (There is deliberately no fallback identity.)
    if (!authUser?.id) return [];
    const uId = authUser.id;
    const uEmail = authUser.email?.trim().toLowerCase() || "";
    const uMsoId = authUser.milestoneOSId?.trim().toUpperCase() || "";
    const uBase = extractBaseCode(uMsoId) || authUser.baseCode?.trim().toUpperCase() || "";

    return rawProjects.filter((p) => {
      // Must not be an unrelated demo fixture in user mode
      if (p.isDemo && p.clientId !== uId && p.freelancerId !== uId && p.client?.email?.toLowerCase() !== uEmail && p.freelancer?.email?.toLowerCase() !== uEmail) {
        return false;
      }

      const clientBase = extractBaseCode(p.client?.milestoneOSId);
      const freelancerBase = extractBaseCode(p.freelancer?.milestoneOSId);

      const isClient =
        (uId && (p.clientId === uId || p.client?.id === uId)) ||
        (uEmail && p.client?.email?.trim().toLowerCase() === uEmail) ||
        (uMsoId && p.client?.milestoneOSId?.trim().toUpperCase() === uMsoId) ||
        (uBase && clientBase === uBase);

      const isFreelancer =
        (uId && (p.freelancerId === uId || p.freelancer?.id === uId)) ||
        (uEmail && p.freelancer?.email?.trim().toLowerCase() === uEmail) ||
        (uMsoId && p.freelancer?.milestoneOSId?.trim().toUpperCase() === uMsoId) ||
        (uBase && freelancerBase === uBase);

      // Perspective-scoped: only show client projects in client view, freelancer projects in freelancer view
      if (role === "client") return Boolean(isClient);
      if (role === "freelancer") return Boolean(isFreelancer);
      return false;
    });
  }, [rawProjects, authUser, role]);

  const activeProject = useMemo(() => {
    if (!projects || projects.length === 0) return undefined;
    const accepted = projects.filter(isProjectAccepted);
    const matched = projects.find((p) => p.id === activeProjectIdState);
    if (matched) return matched;
    if (accepted.length > 0) return accepted[0];
    return undefined;
  }, [projects, activeProjectIdState]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, id);
    } catch (_) {}
  };

  const showAlert = (options: {
    title?: string;
    message: string;
    type?: "info" | "warning" | "error" | "success";
    confirmText?: string;
    onConfirm?: () => void;
  }) => {
    setAlertState({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || "warning",
      confirmText: options.confirmText || "OK",
      isConfirm: false,
      onConfirm: () => {
        setAlertState(null);
        if (options.onConfirm) options.onConfirm();
      },
    });
  };

  const showConfirm = (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    setAlertState({
      isOpen: true,
      title: options.title || "Confirm Action",
      message: options.message,
      type: options.isDestructive ? "error" : "warning",
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      isConfirm: true,
      isDestructive: options.isDestructive,
      onConfirm: () => {
        setAlertState(null);
        options.onConfirm();
      },
      onCancel: () => {
        setAlertState(null);
        if (options.onCancel) options.onCancel();
      },
    });
  };

  const closeAlert = () => setAlertState(null);

  const setActiveTab = (tab: DashboardTab) => {
    const resolvedTab = tab === "overview" ? "dashboard" : tab === "ai-audits" ? "work-review" : tab;
    setActiveTabState(resolvedTab);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, resolvedTab);
    } catch (_) {}
  };

  const setStatusFilter = (filter: string) => {
    setStatusFilterState(filter);
    try {
      localStorage.setItem(STORAGE_KEYS.STATUS_FILTER, filter);
    } catch (_) {}
  };

  const showToast = (message: string, type: "success" | "info" | "warning" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  const hideToast = () => setToast(null);

  const setRole = (newRole: "client" | "freelancer") => {
    setRoleState(newRole);
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, newRole);
    } catch (_) {}
    const actorName = userProfiles[newRole].name;
    showToast(
      `Switched to ${newRole === "client" ? `Client Perspective (${actorName})` : `Freelancer Perspective (${actorName})`}`,
      "info"
    );
  };

  // Exit demo sandbox and return to real user workspace
  const exitDemoMode = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
      localStorage.removeItem("milestoneos_demo_mode");
    } catch (_) {}
    setIsDemoModeState(false);
    refreshProjects();
    showToast("Returned to your authenticated workspace.", "info");
  };

  // Switch perspective directly without empty sandbox isolation
  const enterDemoMode = async (demoRole: "client" | "freelancer" = "client") => {
    try {
      localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
      localStorage.removeItem("milestoneos_demo_mode");
    } catch (_) {}
    setIsDemoModeState(false);
    setRoleState(demoRole);
    refreshProjects();
  };

  // Brings the screen up to date with the server (identity = verified session token).
  //  - never runs two syncs at once, and waits while an action is being saved;
  //  - normally asks only for a tiny "version" and downloads the lists when it changed;
  //  - `force` (used after an action) always downloads.
  // Reads the signed-in user from authUserRef, so it is safe to call from timers created earlier.
  const refreshProjects = (force: boolean = true): Promise<void> => {
    const sync = syncRef.current;
    if (sync.inFlight) {
      if (force) sync.rerun = true; // run once more after the current one, so we never show data older than the action
      return sync.inFlight;
    }
    sync.inFlight = (async () => {
      try {
        await runSync(force);
      } finally {
        sync.inFlight = null;
        if (sync.rerun) {
          sync.rerun = false;
          await refreshProjects(true);
        }
      }
    })();
    return sync.inFlight;
  };

  const runSync = async (force: boolean): Promise<void> => {
    try {
      localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
      localStorage.removeItem("milestoneos_demo_mode");
    } catch (_) {}
    setIsDemoModeState(false);

    const user = authUserRef.current;
    if (!user?.id) return; // never fetch anybody's data without a signed-in user

    const sync = syncRef.current;
    if (sync.mutations > 0) return; // an action is being saved; its own completion refreshes afterwards

    const readJson = (r: Response) => r.json().catch(() => ({}));
    try {
      let needFull = force || !sync.version;
      if (!needFull) {
        const versionRes = await authFetch("/api/projects?versionOnly=1").then(readJson);
        if (!versionRes?.success) throw new Error("version check failed");
        needFull = versionRes.version !== sync.version;
      }

      if (needFull) {
        const [pRes, tRes, nRes] = await Promise.all([
          authFetch("/api/projects").then(readJson).catch(() => ({})),
          authFetch("/api/transactions").then(readJson).catch(() => ({})),
          authFetch("/api/notifications").then(readJson).catch(() => ({})),
        ]);

        // An action started while we were downloading: our copy is already older than the screen, so drop it.
        if (sync.mutations > 0) return;

        // Only replace what we have when the server actually answered; a failed poll keeps the current view.
        if (pRes?.success && Array.isArray(pRes.projects)) {
          setRawProjects(pRes.projects);
          sync.version = pRes.version || "";
          try {
            localStorage.setItem(`milestoneos_projects_${user.id}`, JSON.stringify(slimProjectsForCache(pRes.projects)));
          } catch (_) {}
        } else {
          throw new Error("project refresh failed");
        }

        if (tRes?.success && Array.isArray(tRes.transactions)) {
          setTransactions(tRes.transactions);
          try {
            localStorage.setItem(`milestoneos_transactions_${user.id}`, JSON.stringify(tRes.transactions));
          } catch (_) {}
        }

        if (nRes?.success && Array.isArray(nRes.notifications)) {
          setNotifications(nRes.notifications);
        }
        sync.notificationsAt = Date.now();
      } else if (Date.now() - sync.notificationsAt > 60_000) {
        // Nothing changed in the projects, but keep notifications reasonably fresh.
        const nRes = await authFetch("/api/notifications").then(readJson).catch(() => ({}));
        if (sync.mutations === 0 && nRes?.success && Array.isArray(nRes.notifications)) {
          setNotifications(nRes.notifications);
        }
        sync.notificationsAt = Date.now();
      }
      sync.failures = 0;
    } catch (err) {
      sync.failures++;
      console.warn("Could not refresh projects:", err);
    }
  };

  const updateUserProfile = (
    profileRole: "client" | "freelancer" | "both",
    data: Partial<{ name: string; email: string; company?: string; title?: string }>
  ) => {
    if (!authUser) return;

    const newName = data.name !== undefined ? data.name : authUser.name;
    // The email is the sign-in identity and is verified by the auth service; it cannot be edited from the profile form.
    const newEmail = authUser.email;
    const initials = newName
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const updatedUser: AuthenticatedUser = {
      ...authUser,
      name: newName,
      email: newEmail,
      avatar: initials || authUser.avatar,
      company: data.company !== undefined ? data.company : authUser.company,
      title: data.title !== undefined ? data.title : authUser.title,
    };

    setAuthUser(updatedUser);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(updatedUser));
    } catch (_) {}

    // Persist to Supabase if available
    const supabase = getSupabaseClient();
    if (supabase && authUser.id) {
      Promise.resolve(
        supabase
          .from("profiles")
          .update({
            full_name: updatedUser.name,
            company: updatedUser.company,
            title: updatedUser.title,
            avatar: updatedUser.avatar,
          })
          .eq("id", authUser.id)
      ).catch((err: any) => console.warn("Could not update profile in Supabase:", err));
    }

    showToast("Profile settings updated successfully.", "success");
  };

  // Initial client hydration and auth detection
  useEffect(() => {
    let mounted = true;

    try {
      localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
      localStorage.removeItem("milestoneos_demo_mode");
      setIsDemoModeState(false);

      const savedRole = localStorage.getItem(STORAGE_KEYS.ROLE);
      if (savedRole === "client" || savedRole === "freelancer") {
        setRoleState(savedRole);
      }

      const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) as DashboardTab | null;
      if (savedTab) setActiveTabState(savedTab);

      const savedFilter = localStorage.getItem(STORAGE_KEYS.STATUS_FILTER);
      if (savedFilter) setStatusFilterState(savedFilter);

      const savedActiveProj = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT);
      if (savedActiveProj) setActiveProjectIdState(savedActiveProj);

      // Fast synchronous hydration from local storage
      const savedUserStr = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
      let initialUser: AuthenticatedUser | null = null;
      if (savedUserStr) {
        try {
          initialUser = JSON.parse(savedUserStr);
          if (mounted && initialUser) {
            setAuthUser(initialUser);
          }
        } catch (_) {}
      }

      // Instant SWR Hydration: Render cached projects and transactions immediately (0ms latency!)
      let hadCachedData = false;
      // Only ever restore a cache that belongs to a known signed-in user — never a shared/default one.
      const targetCacheId = initialUser?.id || "";
      const cachedProjectsStr = targetCacheId ? localStorage.getItem(`milestoneos_projects_${targetCacheId}`) : null;
      if (cachedProjectsStr) {
        try {
          const parsedP = JSON.parse(cachedProjectsStr);
          if (Array.isArray(parsedP) && parsedP.length > 0) {
            setRawProjects(parsedP);
            if (!savedActiveProj) setActiveProjectIdState(parsedP[0].id);
            hadCachedData = true;
          }
        } catch (_) {}
      }

      const cachedTxsStr = targetCacheId ? localStorage.getItem(`milestoneos_transactions_${targetCacheId}`) : null;
      if (cachedTxsStr) {
        try {
          const parsedT = JSON.parse(cachedTxsStr);
          if (Array.isArray(parsedT) && parsedT.length > 0) {
            setTransactions(parsedT);
            hadCachedData = true;
          }
        } catch (_) {}
      }

      // If cached data was present, display it immediately without waiting for network
      if (hadCachedData) {
        setIsLoaded(true);
      }

      // Helper to fetch live projects & transactions in parallel in background
      const refreshUserData = async (uId: string) => {
        try {
          const readJson = (r: Response) => r.json().catch(() => ({}));
          const [pData, tData, nData] = await Promise.all([
            authFetch("/api/projects").then(readJson).catch(() => ({})),
            authFetch("/api/transactions").then(readJson).catch(() => ({})),
            authFetch("/api/notifications").then(readJson).catch(() => ({})),
          ]);
          if (!mounted) return;
          if (pData?.success && Array.isArray(pData.projects)) {
            setRawProjects(pData.projects);
            syncRef.current.version = pData.version || "";
            syncRef.current.notificationsAt = Date.now();
            try {
              localStorage.setItem(`milestoneos_projects_${uId}`, JSON.stringify(slimProjectsForCache(pData.projects)));
            } catch (_) {}
          }
          if (tData?.success && Array.isArray(tData.transactions)) {
            setTransactions(tData.transactions);
            try {
              localStorage.setItem(`milestoneos_transactions_${uId}`, JSON.stringify(tData.transactions));
            } catch (_) {}
          }
          if (nData?.success && Array.isArray(nData.notifications)) {
            setNotifications(nData.notifications);
          }
        } catch (_) {}
        if (mounted) setIsLoaded(true);
      };

      // Supabase cloud auth session verification (Highest Priority)
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
          if (!mounted) return;

          if (user) {
            // Real authenticated user detected -> ALWAYS clear demo mode!
            setIsDemoModeState(false);
            try {
              localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
            } catch (_) {}

            let profileRecord: any = null;
            try {
              const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
              profileRecord = data;
            } catch (_) {}

            const userMeta = user.user_metadata || {};
            const cleanEmail = user.email || "";
            const defaultName = cleanEmail.split("@")[0] || "Member";
            const actualName = profileRecord?.full_name || userMeta.name || defaultName;
            const baseCode =
              profileRecord?.base_code ||
              extractBaseCode(profileRecord?.milestone_os_id) ||
              extractBaseCode(userMeta.baseCode) ||
              extractBaseCode(userMeta.milestoneOSId) ||
              user.id.slice(0, 6).toUpperCase();

            const clientId = formatClientId(baseCode);
            const freelancerId = formatFreelancerId(baseCode);

            const roleVal = profileRecord?.role || userMeta.role || "both";
            const rolesList =
              profileRecord?.roles || (roleVal === "both" ? ["client", "freelancer"] : [roleVal]);

            const primaryMsoId = roleVal === "freelancer" ? freelancerId : clientId;
            const resolvedUser: AuthenticatedUser = {
              id: user.id,
              name: actualName,
              email: cleanEmail,
              avatar: profileRecord?.avatar || actualName.slice(0, 2).toUpperCase() || "ME",
              baseCode,
              clientId,
              freelancerId,
              milestoneOSId: primaryMsoId,
              company: profileRecord?.company || userMeta.company || "",
              title: profileRecord?.title || userMeta.title || "",
              role: roleVal,
              roles: rolesList,
            };

            setAuthUser(resolvedUser);
            try {
              localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(resolvedUser));
            } catch (_) {}

            // Auto-align view with user's primary registered role from Supabase
            const urlRole = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("role") : null;
            if (!urlRole) {
              if (roleVal === "freelancer") {
                setRoleState("freelancer");
                try {
                  localStorage.setItem(STORAGE_KEYS.ROLE, "freelancer");
                } catch (_) {}
              } else if (roleVal === "client") {
                setRoleState("client");
                try {
                  localStorage.setItem(STORAGE_KEYS.ROLE, "client");
                } catch (_) {}
              }
            } else if (urlRole === "client" || urlRole === "freelancer") {
              setRoleState(urlRole);
            }

            // Always refresh live data for the authenticated user from Supabase
            refreshUserData(resolvedUser.id);
          } else {
            // Unauthenticated user: try refreshing with locally cached user if available
            if (initialUser?.id) {
              refreshUserData(initialUser.id);
            } else {
              setAuthUser(null);
              setRawProjects([]);
              setTransactions([]);
              setNotifications([]);
              setIsLoaded(true);
            }
          }
        });
      } else {
        if (initialUser?.id) {
          refreshUserData(initialUser.id);
        } else {
          setIsLoaded(true);
        }
      }
    } catch (e) {
      console.warn("Could not hydrate dashboard state:", e);
      setIsLoaded(true);
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Save projects to scoped cache
  useEffect(() => {
    if (!isLoaded || !authUser?.id) return;
    try {
      localStorage.setItem(`milestoneos_projects_${authUser.id}`, JSON.stringify(slimProjectsForCache(rawProjects)));
    } catch (_) {}
  }, [rawProjects, isLoaded, authUser]);

  // Save transactions to scoped cache
  useEffect(() => {
    if (!isLoaded || !authUser?.id) return;
    try {
      localStorage.setItem(`milestoneos_transactions_${authUser.id}`, JSON.stringify(transactions));
    } catch (_) {}
  }, [transactions, isLoaded, authUser]);

  // Background sync: one check every 15 s while the tab is visible (slower after failures), plus a check
  // when the tab/window becomes active again. Checks never overlap (see refreshProjects).
  useEffect(() => {
    if (!isLoaded) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await refreshProjects(false);
      if (stopped) return;
      const delay = Math.min(15_000 * 2 ** Math.min(syncRef.current.failures, 3), 120_000);
      timer = setTimeout(tick, delay);
    };
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      tick();
    };

    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    timer = setTimeout(tick, 15_000);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
    // refreshProjects only depends on refs and state setters, so the first closure is always correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Action: Create Project / Propose Project
  const createProjectImpl = (
    newProjectData: Omit<
      ProjectContract,
      "id" | "createdAt" | "totalPaid" | "escrowFunded" | "escrowReleased" | "activityLog"
    >,
    asDraft: boolean = false
  ): string => {
    const id = `proj_${Date.now()}`;
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    const isClientInitiator = newProjectData.initiatedBy === "client";
    const senderProfile = isClientInitiator ? userProfiles.client : userProfiles.freelancer;
    const senderName = isClientInitiator ? newProjectData.client.name : newProjectData.freelancer.name;
    const recipientName = newProjectData.isPublicInvitation
      ? "Unassigned (Private Invitation Link)"
      : isClientInitiator
      ? newProjectData.freelancer.name
      : newProjectData.client.name;
    const initialStatus = asDraft ? "draft" : "awaiting_acceptance";

    const invToken = newProjectData.isPublicInvitation
      ? newProjectData.invitationToken || generateInvitationToken()
      : undefined;

    const newProject: ProjectContract = {
      ...newProjectData,
      id,
      createdAt: now,
      totalPaid: 0,
      escrowFunded: 0,
      escrowReleased: 0,
      status: initialStatus,
      proposalStatus: asDraft ? "draft" : "awaiting_acceptance",
      termsAgreed: false,
      initiatorMilestoneOSId: senderProfile.milestoneOSId,
      invitationToken: invToken,
      invitationStatus: newProjectData.isPublicInvitation ? "active" : undefined,
      invitationExpiresAt: newProjectData.isPublicInvitation
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      clientId: isClientInitiator
        ? (authUser?.id || newProjectData.clientId || newProjectData.client.id)
        : (newProjectData.clientId || newProjectData.client.id),
      freelancerId: !isClientInitiator
        ? (authUser?.id || newProjectData.freelancerId || newProjectData.freelancer.id)
        : (newProjectData.freelancerId || newProjectData.freelancer.id),
      isDemo: false,
      activityLog: [
        {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: senderName,
          actorRole: isClientInitiator ? "client" : "freelancer",
          action: asDraft
            ? `Created draft project "${newProjectData.title}" (${formatCurrency(newProjectData.totalBudget, newProjectData.currency)}).`
            : newProjectData.isPublicInvitation
            ? `${senderName} created project proposal "${newProjectData.title}" and generated a private shareable invitation link.`
            : `${senderName} submitted project proposal "${newProjectData.title}" to ${recipientName} for acceptance.`,
        },
      ],
    };

    setRawProjects((prev) => [newProject, ...prev]);
    setActiveProjectIdState(id);

    // Sync to backend API & Supabase. The server decides who the proposer is (from the signed-in session).
    mutFetch("/api/projects", {
      method: "POST",
      body: JSON.stringify(newProject),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data.success && data.project) {
          setRawProjects((prev) =>
            prev.some((p) => p.id === id)
              ? prev.map((p) => (p.id === id ? { ...data.project, isDemo: Boolean(data.project.isDemo) } : p))
              : [data.project, ...prev.filter((p) => p.id !== data.project.id)]
          );
          setActiveProjectIdState((current) => (current === id ? data.project.id : current));
        } else {
          // The server rejected it (e.g. unknown recipient): remove the optimistic copy and say why.
          setRawProjects((prev) => prev.filter((p) => p.id !== id));
          setNotifications((prev) => prev.filter((n) => n.projectId !== id));
          showToast(data.error || "The proposal could not be created.", "warning");
        }
      })
      .catch((err) => {
        console.warn("Failed to sync project creation to API:", err);
        setRawProjects((prev) => prev.filter((p) => p.id !== id));
        showToast("Could not reach the server. The proposal was not created.", "warning");
      })
      .finally(() => {
        creatingRef.current = false;
      });

    if (!asDraft) {
      const proposalBudget = formatCurrency(newProject.totalBudget, newProject.currency);
      const senderNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        timestamp: "Just now",
        title: isClientInitiator ? "Proposal Dispatched" : "Proposal Submitted",
        message: `Proposal for "${newProject.title}" (${proposalBudget}) submitted to ${recipientName}. Awaiting counterparty review.`,
        type: "system",
        unread: false,
        projectId: id,
        userId: authUser?.id,
        isDemo: false,
      };

      // Add dispatch notification for sender only (recipient notification is stored in Supabase)
      setNotifications((prev) => [senderNotif, ...prev]);
    }

    showToast(
      asDraft
        ? `Draft "${newProject.title}" saved.`
        : newProjectData.isPublicInvitation
        ? `Shareable invitation created! Copy the link to invite your counterparty.`
        : `Proposal "${newProject.title}" sent to ${recipientName}!`,
      "success"
    );
    return id;
  };

  const updateProject = async (projectId: string, updates: Partial<ProjectContract>) => {
    setRawProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p)));
    try {
      const res = await mutFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Could not save project changes.");
      if (data.project) {
        setRawProjects((prev) => prev.map((p) => (p.id === projectId ? data.project : p)));
      }
      showToast("Project settings updated.", "success");
    } catch (err: any) {
      showToast(err?.message || "Could not save project changes.", "warning");
      refreshProjects(); // roll the screen back to what the server actually has
    }
  };

  const archiveProject = (projectId: string) => {
    updateProject(projectId, { status: "archived" });
  };

  const acceptProposalImpl = async (projectId: string) => {
    const target = rawProjects.find((p) => p.id === projectId);
    const projTitle = target?.title || "";
    const actorName = userProfiles[role].name;
    const nowStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newLog: ActivityItem = {
      id: `act_${Date.now()}`,
      timestamp: "Just now",
      actor: actorName,
      actorRole: role,
      action: `${actorName} accepted the project proposal and agreed to contract terms. Agreement is now active.`,
    };

    setRawProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const updatedMilestones = p.milestones.map((m, idx) => ({
          ...m,
          status: m.status || (idx === 0 ? ("in_progress" as const) : ("not_started" as const)),
        }));

        return {
          ...p,
          status: "active" as const,
          proposalStatus: "accepted" as const,
          termsAgreed: true,
          acceptedAt: nowStr,
          acceptedByMilestoneOSId: userProfiles[role].milestoneOSId,
          milestones: updatedMilestones,
          activityLog: [newLog, ...p.activityLog],
        };
      })
    );

    setActiveProjectIdState(projectId);
    setActiveTabState("projects");
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, projectId);
    } catch (_) {}

    // Persist acceptance to server database & Supabase (the server verifies who is accepting)
    try {
      const res = await mutFetch(`/api/projects/${projectId}/proposals`, {
        method: "POST",
        body: JSON.stringify({ action: "accept" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.project) {
        throw new Error(data.error || "Server failed to accept proposal");
      }

      setRawProjects((prev) => prev.map((p) => (p.id === projectId ? data.project : p)));
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}`,
          timestamp: "Just now",
          title: "Proposal Accepted & Contract Active",
          message: `The project "${data.project.title || projTitle}" has been accepted. Work on agreed milestones may now begin.`,
          type: "approval",
          unread: true,
          projectId,
          userId: authUser?.id,
        },
        ...prev,
      ]);
      showToast(`Proposal accepted! Contract "${data.project.title || projTitle}" is now active in My Projects.`, "success");
      refreshProjects();
    } catch (err: any) {
      console.error("Proposal acceptance error:", err);
      refreshProjects();
      showToast(err.message || "Failed to accept proposal. Please try again.", "warning");
    }
  };

  const requestProposalChangesImpl = async (projectId: string, feedback: string) => {
    try {
      const res = await mutFetch(`/api/projects/${projectId}/proposals`, {
        method: "POST",
        body: JSON.stringify({ action: "request_changes", feedback }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit revision request");
      }
      showToast("Feedback submitted to proposer.", "info");
      refreshProjects();
    } catch (err: any) {
      console.warn("Failed to sync change request to API:", err);
      showToast(err.message || "Could not submit revision request.", "warning");
      refreshProjects();
    }
  };

  const rejectProposalImpl = async (projectId: string, reason?: string) => {
    try {
      // Immediately remove from local state so the view clears right away (restored by the refresh if it fails)
      setRawProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProject?.id === projectId) {
        setActiveProjectIdState("");
      }

      const res = await mutFetch(`/api/projects/${projectId}/proposals`, {
        method: "POST",
        body: JSON.stringify({ action: "reject", feedback: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to decline proposal");
      }
      showToast("Project proposal declined and removed from workspace.", "info");
      refreshProjects();
    } catch (err: any) {
      console.warn("Failed to sync rejection to API:", err);
      showToast(err.message || "Could not decline proposal.", "warning");
      refreshProjects();
    }
  };

  const resubmitProposalImpl = async (projectId: string, updatedData: Partial<ProjectContract>) => {
    const actorName = userProfiles[role].name;
    setRawProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: role,
          action: `${actorName} revised and resubmitted the project proposal for acceptance.`,
        };
        return {
          ...p,
          ...updatedData,
          status: "awaiting_acceptance" as const,
          proposalStatus: "awaiting_acceptance" as const,
          proposalFeedback: undefined,
          activityLog: [newLog, ...p.activityLog],
        };
      })
    );

    // Persist revised proposal to server database & Supabase
    try {
      const res = await mutFetch(`/api/projects/${projectId}/proposals`, {
        method: "POST",
        body: JSON.stringify({ action: "resubmit", updatedData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not resubmit the proposal.");
      }
      if (data.project) {
        setRawProjects((prev) => prev.map((p) => (p.id === projectId ? data.project : p)));
      }
      showToast("Revised proposal submitted for acceptance.", "success");
    } catch (err: any) {
      console.warn("Failed to sync resubmission to API:", err);
      showToast(err?.message || "Could not resubmit the proposal.", "warning");
      refreshProjects();
    }
  };

  const revokeInvitationImpl = async (projectId: string) => {
    const target = rawProjects.find((p) => p.id === projectId);
    const token = target?.invitationToken;
    if (!token) {
      showToast("This proposal has no invitation link to revoke.", "warning");
      return;
    }

    const actorName = userProfiles[role].name;
    setRawProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: role,
          action: `${actorName} revoked the private invitation link for proposal "${p.title}".`,
        };
        return {
          ...p,
          invitationStatus: "revoked" as const,
          status: "rejected" as const,
          proposalStatus: "rejected" as const,
          activityLog: [newLog, ...p.activityLog],
        };
      })
    );

    try {
      const res = await mutFetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ action: "revoke" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Could not revoke the invitation link.");
      showToast("Invitation link revoked.", "info");
      refreshProjects();
    } catch (err: any) {
      showToast(err?.message || "Could not revoke the invitation link.", "warning");
      refreshProjects();
    }
  };

  // The server verifies the signed-in user, checks the link and binds the contract to that account.
  const acceptInvitationByToken = async (
    token: string
  ): Promise<{ success: boolean; project?: ProjectContract; error?: string }> => {
    try {
      const res = await mutFetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ action: "accept" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.project) {
        return { success: false, error: data.error || "Failed to accept proposal." };
      }
      const project: ProjectContract = data.project;
      setRawProjects((prev) => [project, ...prev.filter((p) => p.id !== project.id)]);
      setActiveProjectIdState(project.id);
      refreshProjects();
      return { success: true, project };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to accept proposal." };
    }
  };

  /**
   * Runs the server call that backs an optimistic screen change. If the server refuses
   * (not allowed, wrong state, offline) the reason is shown and the screen is re-synced
   * from the server so it never keeps displaying something that did not actually happen.
   */
  const syncOrRevert = async (request: Promise<Response>, failMessage: string): Promise<boolean> => {
    try {
      const res = await request;
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || failMessage);
      if (data.project && data.project.id) {
        const fresh: ProjectContract = data.project;
        setRawProjects((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
      }
      return true;
    } catch (err: any) {
      showToast(err?.message || failMessage, "warning");
      refreshProjects();
      return false;
    }
  };

  const addMilestoneImpl = (
    projectId: string,
    data: {
      title: string;
      description?: string;
      amount: number;
      currency?: string;
      dueDate?: string;
      acceptanceCriteria?: string[];
    }
  ) => {
    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const newStageNumber = project.milestones.length + 1;
        const newId = `ms_${Date.now()}`;
        const newMilestone: Milestone = {
          id: newId,
          stageNumber: newStageNumber,
          title: data.title,
          description: data.description || "Milestone deliverables agreed with client.",
          amount: data.amount,
          currency: project.currency || "USD",
          dueDate: data.dueDate || project.targetDeadline || "TBD",
          status: "not_started",
          acceptanceCriteria: (data.acceptanceCriteria || []).map((critTitle, idx) => ({
            id: `crit_${Date.now()}_${idx}`,
            title: critTitle,
            description: `Verified deliverable for ${critTitle}`,
            status: "pending",
          })),
          submissions: [],
        };

        const actorName = userProfiles[role].name;
        const curr = project.currency || "USD"; // milestones always use the project's currency
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: role,
          action: `${actorName} added a new milestone: Stage 0${newStageNumber}: "${data.title}" (${formatCurrency(data.amount, curr)}).`,
          milestoneTitle: data.title,
        };

        return {
          ...project,
          totalBudget: roundMoney(project.totalBudget + data.amount),
          milestones: [...project.milestones, newMilestone],
          activityLog: [newLog, ...project.activityLog],
        };
      })
    );

    // Sync to backend API
    const curr = rawProjects.find((p) => p.id === projectId)?.currency || "USD";
    return syncOrRevert(
      mutFetch("/api/milestones", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          title: data.title,
          description: data.description,
          amount: data.amount,
          dueDate: data.dueDate,
          acceptanceCriteria: data.acceptanceCriteria,
        }),
      }),
      "Could not add the milestone."
    ).then((ok) => {
      if (ok) showToast(`Added Stage "${data.title}" (${formatCurrency(data.amount, curr)}).`, "success");
    });
  };

  const editMilestoneImpl = (
    projectId: string,
    milestoneId: string,
    updates: {
      title?: string;
      description?: string;
      amount?: number;
      dueDate?: string;
    }
  ) => {
    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const isAccepted = isProjectAccepted(project);
        // Milestone price is strictly locked once the contract/proposal is accepted
        const effectiveAmount = isAccepted ? undefined : updates.amount;

        let diff = 0;
        const updatedMilestones = project.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          if (effectiveAmount !== undefined && effectiveAmount !== m.amount) {
            diff = effectiveAmount - m.amount;
          }
          return {
            ...m,
            title: updates.title || m.title,
            description: updates.description !== undefined ? updates.description : m.description,
            amount: effectiveAmount !== undefined ? effectiveAmount : m.amount,
            dueDate: updates.dueDate || m.dueDate,
          };
        });

        const actorName = userProfiles[role].name;
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: role,
          action: isAccepted
            ? `${actorName} updated milestone deliverables and timeline with mutual consent.`
            : `${actorName} edited milestone terms.`,
        };

        return {
          ...project,
          totalBudget: roundMoney(project.totalBudget + diff),
          milestones: updatedMilestones,
          activityLog: [newLog, ...project.activityLog],
        };
      })
    );

    // Sync to backend API
    return syncOrRevert(
      mutFetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({
          projectId,
          title: updates.title,
          description: updates.description,
          amount: updates.amount,
          dueDate: updates.dueDate,
        }),
      }),
      "Could not update the milestone."
    ).then((ok) => {
      if (ok) showToast("Milestone updated.", "success");
    });
  };

  const startMilestoneWorkImpl = (projectId: string, milestoneId: string) => {
    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        let milestoneTitle = "";
        const updatedMilestones = project.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          milestoneTitle = m.title;
          return { ...m, status: "in_progress" as MilestoneStatus };
        });

        const actorName = userProfiles.freelancer.name;
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: "freelancer",
          action: `${actorName} started work on "${milestoneTitle}".`,
          milestoneTitle,
        };

        return {
          ...project,
          milestones: updatedMilestones,
          activityLog: [newLog, ...project.activityLog],
        };
      })
    );
    return syncOrRevert(
      mutFetch(`/api/milestones/${milestoneId}/start`, {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }),
      "Could not start the milestone."
    ).then((ok) => {
      if (ok) showToast("Milestone marked as in progress.", "info");
    });
  };

  const submitMilestoneDeliverablesImpl = async (
    projectId: string,
    milestoneId: string,
    deliverables: {
      demoUrl?: string;
      githubRepo?: string;
      githubPr?: string;
      loomVideo?: string;
      notes: string;
      deliverableLinks?: DeliverableLink[];
      attachments?: DeliverableAttachment[];
    },
    isRevision: boolean = false
  ) => {
    const submissionId = `sub_${Date.now()}`;
    const nowStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Read what we need up front; state updaters below stay free of side effects.
    const target = rawProjects.find((p) => p.id === projectId);
    const submittedMilestoneTitle = target?.milestones.find((m) => m.id === milestoneId)?.title || "";
    const freelancerName = target?.freelancer.name || userProfiles.freelancer.name;

    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const updatedMilestones = project.milestones.map((m) => {
          if (m.id !== milestoneId) return m;

          const newSubmission: MilestoneSubmission = {
            id: submissionId,
            version: (m.submissions?.length || 0) + 1,
            submittedAt: nowStr,
            submittedBy: freelancerName,
            notes: deliverables.notes,
            demoUrl: deliverables.demoUrl,
            githubRepo: deliverables.githubRepo,
            loomVideo: deliverables.loomVideo,
            deliverableLinks: deliverables.deliverableLinks || [],
            attachments: deliverables.attachments || [],
          };

          return {
            ...m,
            status: "submitted" as MilestoneStatus,
            latestAudit: undefined,
            submissions: [...(m.submissions || []), newSubmission],
          };
        });

        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: freelancerName,
          actorRole: "freelancer",
          action: isRevision
            ? `Resubmitted revised deliverables for "${submittedMilestoneTitle}".`
            : `Submitted deliverables for "${submittedMilestoneTitle}".`,
          milestoneTitle: submittedMilestoneTitle,
        };

        return {
          ...project,
          milestones: updatedMilestones,
          activityLog: [newLog, ...project.activityLog],
        };
      })
    );

    // Call API submit route for automated Gemini review and backend database persistence.
    // The server identifies the freelancer from the signed-in session, not from anything we send.
    try {
      const res = await mutFetch(`/api/milestones/${milestoneId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          projectId,
          notes: deliverables.notes,
          demoUrl: deliverables.demoUrl,
          githubRepo: deliverables.githubRepo,
          loomVideo: deliverables.loomVideo,
          deliverableLinks: deliverables.deliverableLinks,
          attachments: deliverables.attachments,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit milestone work");
      }

      if (data.project) {
        setRawProjects((prev) => prev.map((p) => (p.id === projectId ? data.project : p)));
      }

      showToast(
        isRevision
          ? `Revised work for "${submittedMilestoneTitle}" submitted.`
          : `Work for "${submittedMilestoneTitle}" submitted and verified!`,
        "success"
      );
      refreshProjects();
    } catch (err: any) {
      console.error("Milestone submission error:", err);
      showToast(err.message || "Failed to submit deliverables. Please check connection and try again.", "warning");
      refreshProjects();
    }
  };

  const requestRevision = (projectId: string, milestoneId: string, reason: string) => {
    requestChanges(projectId, milestoneId, reason);
  };

  const requestChangesImpl = (projectId: string, milestoneId: string, reason: string) => {
    const target = rawProjects.find((p) => p.id === projectId);
    const milestoneTitle = target?.milestones.find((m) => m.id === milestoneId)?.title || "";

    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const updatedMilestones = project.milestones.map((m) =>
          m.id !== milestoneId ? m : { ...m, status: "changes_requested" as MilestoneStatus }
        );

        const actorName = userProfiles.client.name;
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: "client",
          action: `${actorName} requested changes on "${milestoneTitle}".`,
          details: reason,
          milestoneTitle,
        };

        return {
          ...project,
          milestones: updatedMilestones,
          activityLog: [newLog, ...project.activityLog],
        };
      })
    );

    // Sync to backend API (reverts the screen and explains if the server refuses)
    return syncOrRevert(
      mutFetch(`/api/milestones/${milestoneId}/review`, {
        method: "POST",
        body: JSON.stringify({ projectId, action: "request_changes", feedback: reason }),
      }),
      "Could not send the change request."
    ).then((ok) => {
      if (ok) showToast(`Changes requested for "${milestoneTitle}". Feedback sent.`, "warning");
    });
  };

  const approveMilestoneImpl = async (projectId: string, milestoneId: string): Promise<boolean> => {
    const target = rawProjects.find((p) => p.id === projectId);
    const milestoneTitle = target?.milestones.find((m) => m.id === milestoneId)?.title || "";

    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const updatedMilestones = project.milestones.map((m) =>
          m.id !== milestoneId ? m : { ...m, status: "approved" as MilestoneStatus }
        );

        const actorName = userProfiles.client.name;
        const newLog: ActivityItem = {
          id: `act_${Date.now()}`,
          timestamp: "Just now",
          actor: actorName,
          actorRole: "client",
          action: `${actorName} approved "${milestoneTitle}". Ready for payment release.`,
          milestoneTitle,
        };

        return {
          ...project,
          milestones: updatedMilestones,
          activityLog: [newLog, ...project.activityLog],
        };
      })
    );

    // Sync to backend API (reverts the screen and explains if the server refuses)
    const ok = await syncOrRevert(
      mutFetch(`/api/milestones/${milestoneId}/review`, {
        method: "POST",
        body: JSON.stringify({ projectId, action: "approve" }),
      }),
      "Could not approve the milestone."
    );
    if (ok) showToast(`"${milestoneTitle}" approved! You can now release payment.`, "success");
    return ok;
  };

  const setMilestoneAudit = (
    projectId: string,
    milestoneId: string,
    audit: AIAssessment
  ) => {
    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const updatedMilestones = project.milestones.map((m) => {
          if (m.id !== milestoneId) return m;

          const updatedSubmissions = [...(m.submissions || [])];
          if (updatedSubmissions.length > 0) {
            const lastIdx = updatedSubmissions.length - 1;
            updatedSubmissions[lastIdx] = {
              ...updatedSubmissions[lastIdx],
              aiAssessment: audit,
            };
          }

          return {
            ...m,
            latestAudit: audit,
            submissions: updatedSubmissions,
          };
        });

        return {
          ...project,
          milestones: updatedMilestones,
        };
      })
    );
  };

  const releasePayment = (projectId: string, milestoneId: string, verifiedCaptureId: string): string => {
    return makePayment(projectId, milestoneId, verifiedCaptureId);
  };

  const makePayment = (
    projectId: string,
    milestoneId: string,
    verifiedCaptureId: string,
    timestamp?: string
  ): string => {
    if (!verifiedCaptureId) {
      throw new Error("Cannot record payment without a verified payment capture confirmation.");
    }

    const txId = verifiedCaptureId;
    const paidDate = timestamp && !Number.isNaN(new Date(timestamp).getTime()) ? new Date(timestamp) : new Date();
    const nowStr = paidDate.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Read what we need up front; the state updater below stays free of side effects.
    const target = rawProjects.find((p) => p.id === projectId);
    const targetMilestone = target?.milestones.find((m) => m.id === milestoneId);
    const paidAmount = targetMilestone?.amount || 0;
    const milestoneTitle = targetMilestone?.title || "";
    const paidCurrency = targetMilestone?.currency || target?.currency || "USD";
    const paidLabel = formatCurrency(paidAmount, paidCurrency);

    setRawProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;

        const updatedMilestones = project.milestones.map((m) =>
          m.id !== milestoneId
            ? m
            : {
                ...m,
                status: "paid" as MilestoneStatus,
                paidAt: nowStr,
                transactionId: txId,
              }
        );

        const allMilestonesPaid =
          updatedMilestones.length > 0 && updatedMilestones.every((m) => m.status === "paid");

        const completionActivity: ActivityItem[] = allMilestonesPaid
          ? [
              {
                id: `act_completed_${Date.now()}`,
                timestamp: "Just now",
                actor: "PayZorr",
                actorRole: "payment",
                action: `Project "${project.title}" completed! All ${updatedMilestones.length} milestones paid and fully settled.`,
                details: `100% of milestones completed. Total payout: ${formatCurrency(roundMoney(project.totalPaid + paidAmount), project.currency)}.`,
              },
            ]
          : [];

        return {
          ...project,
          status: allMilestonesPaid ? ("completed" as const) : project.status,
          totalPaid: roundMoney(project.totalPaid + paidAmount),
          escrowReleased: roundMoney(project.escrowReleased + paidAmount),
          milestones: updatedMilestones,
          activityLog: [
            ...completionActivity,
            {
              id: `act_${Date.now()}`,
              timestamp: "Just now",
              actor: project.client.name,
              actorRole: "payment",
              action: `Completed payment of ${paidLabel} via Secure Payments`,
              details: `Transaction: ${txId}`,
              milestoneTitle,
            },
            ...project.activityLog,
          ],
        };
      })
    );

    showToast(`Payment of ${paidLabel} completed.`, "success");
    // The server has already recorded the verified payment and its ledger entry; pull the real records
    // instead of inventing a local transaction.
    refreshProjects();
    return txId;
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    authFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    authFetch("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  };

  const resetToFactoryDefaults = () => {
    refreshProjects();
    showToast("Workspace refreshed from server.", "info");
  };

  // ---- Public actions: each one ignores repeated clicks while the same action is still being saved ----
  const createProject = (...args: Parameters<typeof createProjectImpl>): string => {
    if (creatingRef.current) return lastCreatedIdRef.current;
    creatingRef.current = true;
    const id = createProjectImpl(...args);
    lastCreatedIdRef.current = id;
    return id;
  };
  const acceptProposal = (projectId: string) => runOnce(`accept:${projectId}`, () => acceptProposalImpl(projectId), undefined);
  const requestProposalChanges = (projectId: string, feedback: string) =>
    runOnce(`propchanges:${projectId}`, () => requestProposalChangesImpl(projectId, feedback), undefined);
  const rejectProposal = (projectId: string, reason?: string) =>
    runOnce(`reject:${projectId}`, () => rejectProposalImpl(projectId, reason), undefined);
  const resubmitProposal = (projectId: string, updatedData: Partial<ProjectContract>) =>
    runOnce(`resubmit:${projectId}`, () => resubmitProposalImpl(projectId, updatedData), undefined);
  const revokeInvitation = (projectId: string) =>
    runOnce(`revoke:${projectId}`, () => revokeInvitationImpl(projectId), undefined);
  const addMilestone = (...args: Parameters<typeof addMilestoneImpl>) =>
    runOnce(`addms:${args[0]}`, () => addMilestoneImpl(...args), undefined);
  const editMilestone = (...args: Parameters<typeof editMilestoneImpl>) =>
    runOnce(`editms:${args[1]}`, () => editMilestoneImpl(...args), undefined);
  const startMilestoneWork = (projectId: string, milestoneId: string) =>
    runOnce(`start:${milestoneId}`, () => startMilestoneWorkImpl(projectId, milestoneId), undefined);
  const submitMilestoneDeliverables = (...args: Parameters<typeof submitMilestoneDeliverablesImpl>) =>
    runOnce(`submit:${args[1]}`, () => submitMilestoneDeliverablesImpl(...args), undefined);
  const requestChanges = (projectId: string, milestoneId: string, reason: string) =>
    runOnce(`changes:${milestoneId}`, () => requestChangesImpl(projectId, milestoneId, reason), undefined);
  const approveMilestone = (projectId: string, milestoneId: string): Promise<boolean> =>
    runOnce(`approve:${milestoneId}`, () => approveMilestoneImpl(projectId, milestoneId), false);

  return (
    <DashboardContext.Provider
      value={{
        role,
        setRole,
        userProfiles,
        updateUserProfile,
        activeTab,
        setActiveTab,
        projects,
        allProjects: rawProjects,
        activeProjectId: activeProjectIdState,
        setActiveProjectId,
        activeProject,
        transactions,
        notifications,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        toast,
        showToast,
        hideToast,
        alertState,
        showAlert,
        showConfirm,
        closeAlert,
        isDemoMode,
        setIsDemoMode: setIsDemoModeState,
        exitDemoMode,
        enterDemoMode,
        authUser,
        isLoaded,
        refreshProjects,
        createProject,
        updateProject,
        archiveProject,
        acceptProposal,
        requestProposalChanges,
        rejectProposal,
        resubmitProposal,
        revokeInvitation,
        acceptInvitationByToken,
        addMilestone,
        editMilestone,
        startMilestoneWork,
        submitMilestoneDeliverables,
        requestRevision,
        requestChanges,
        approveMilestone,
        setMilestoneAudit,
        releasePayment,
        makePayment,
        markNotificationRead,
        clearAllNotifications,
        resetToFactoryDefaults,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
