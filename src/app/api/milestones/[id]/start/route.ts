import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { assertFreelancer, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

/** Freelancer marks a not-started milestone as in progress. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireCaller(req);
    const { id: milestoneId } = await params;
    const body = await readJson(req);

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) throw new DomainError(400, "projectId is required");

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
    assertFreelancer(project, caller, "Only the designated freelancer can start work on a milestone.");

    const result = await db.startMilestone(projectId, milestoneId, caller.name);
    if (!result) throw new DomainError(404, "Project not found", "NOT_FOUND");

    return NextResponse.json({
      success: true,
      milestone: result.milestone,
      project: result.project,
    });
  } catch (err) {
    return errorResponse(err, "Failed to start milestone");
  }
}
