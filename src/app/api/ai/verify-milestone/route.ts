import { NextRequest, NextResponse } from "next/server";
import { verifyMilestoneWithAI, computeMilestoneFingerprint } from "@/server/gemini";
import { db } from "@/server/db";
import { assertParticipant, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import type { AIAssessment } from "@/lib/dashboard-data";

// In-memory cache for fast lookup and de-duplication of in-flight requests (bounded so it cannot grow forever)
const AUDIT_CACHE_MAX = 200;
const auditCache = new Map<string, AIAssessment>();
const inFlightRequests = new Map<string, Promise<AIAssessment>>();

function cacheAudit(key: string, assessment: AIAssessment) {
  if (auditCache.has(key)) auditCache.delete(key);
  auditCache.set(key, assessment);
  while (auditCache.size > AUDIT_CACHE_MAX) {
    const oldest = auditCache.keys().next().value;
    if (oldest === undefined) break;
    auditCache.delete(oldest);
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId : "";
    const forceRefresh = body.forceRefresh === true;

    if (!projectId || !milestoneId) {
      throw new DomainError(400, "projectId and milestoneId are required");
    }

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
    assertParticipant(project, caller);

    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new DomainError(404, "Milestone not found", "NOT_FOUND");

    // The audit always evaluates the work that is actually stored on the server. A submission
    // supplied by the caller is ignored, so nobody can plant evidence into the audit record.
    const effectiveSubmission =
      milestone.submissions && milestone.submissions.length > 0
        ? milestone.submissions[milestone.submissions.length - 1]
        : null;
    if (!effectiveSubmission) {
      throw new DomainError(400, "There is no submitted work on this milestone to audit yet.", "NO_SUBMISSION");
    }

    // Compute fingerprint to detect unchanged submissions
    const fingerprint = computeMilestoneFingerprint(
      milestone.title,
      milestone.description,
      milestone.acceptanceCriteria,
      effectiveSubmission
    );

    const cacheKey = `${projectId}_${milestoneId}_${fingerprint}`;

    // 1. Check existing audit in memory cache or milestone DB if not force-refreshing
    if (!forceRefresh) {
      const cached = auditCache.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          assessment: { ...cached, isCached: true },
          milestoneId: milestone.id,
          projectTitle: project.title,
          cached: true,
        });
      }

      if (milestone.latestAudit && milestone.latestAudit.submissionFingerprint === fingerprint) {
        return NextResponse.json({
          success: true,
          assessment: { ...milestone.latestAudit, isCached: true },
          milestoneId: milestone.id,
          projectTitle: project.title,
          cached: true,
        });
      }
    }

    // 2. Prevent duplicate in-flight requests
    let auditPromise = inFlightRequests.get(cacheKey);
    if (!auditPromise) {
      auditPromise = (async () => {
        try {
          const assessment = await verifyMilestoneWithAI({
            milestoneTitle: milestone.title,
            milestoneDescription: milestone.description,
            acceptanceCriteria: milestone.acceptanceCriteria,
            submission: effectiveSubmission,
          });

          assessment.submissionFingerprint = fingerprint;

          // Save to server database, then to the memory cache
          await db.setMilestoneAudit(projectId, milestone.id, assessment);
          cacheAudit(cacheKey, assessment);

          return assessment;
        } finally {
          inFlightRequests.delete(cacheKey);
        }
      })();
      inFlightRequests.set(cacheKey, auditPromise);
    }

    const assessment = await auditPromise;

    return NextResponse.json({
      success: true,
      assessment,
      milestoneId: milestone.id,
      projectTitle: project.title,
      cached: false,
    });
  } catch (err: any) {
    const isQuotaExceeded =
      err?.message?.toLowerCase?.().includes("quota") ||
      err?.message?.includes?.("429") ||
      err?.message?.toLowerCase?.().includes("resource_exhausted");
    if (isQuotaExceeded && !(err instanceof DomainError)) {
      return NextResponse.json(
        {
          error: "Gemini API usage quota exceeded (HTTP 429). Please wait a moment before trying again.",
          isQuotaExceeded: true,
        },
        { status: 429 }
      );
    }
    return errorResponse(err, "Failed to perform AI acceptance check");
  }
}
