import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { assertClient, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireCaller(req);
    const { id: milestoneId } = await params;
    const body = await readJson(req);

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const action = body.action;
    const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 2000) : undefined;

    if (!projectId || !action) {
      throw new DomainError(400, "projectId and action ('approve' | 'request_changes') are required");
    }
    if (action !== "approve" && action !== "request_changes") {
      throw new DomainError(400, "action must be either 'approve' or 'request_changes'");
    }

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");

    // Only the client of this project may approve or request changes.
    assertClient(
      project,
      caller,
      "Unauthorized. Only the designated client can approve or request changes on milestone deliverables."
    );

    if (!project.milestones.some((m) => m.id === milestoneId)) {
      throw new DomainError(404, "Milestone not found", "NOT_FOUND");
    }

    // db.reviewMilestone enforces that the milestone actually has submitted work to review.
    const result = await db.reviewMilestone(projectId, milestoneId, action, feedback);
    if (!result) throw new DomainError(404, "Project not found", "NOT_FOUND");

    return NextResponse.json({
      success: true,
      action,
      milestone: result.milestone,
      project: result.project,
    });
  } catch (err) {
    return errorResponse(err, "Failed to submit milestone review");
  }
}
