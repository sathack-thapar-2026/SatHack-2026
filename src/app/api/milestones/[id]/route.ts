import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { assertParticipant, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

export async function PATCH(
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
    assertParticipant(project, caller);

    const updates: { title?: string; description?: string; amount?: number; dueDate?: string } = {};
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim().slice(0, 200);
    if (typeof body.description === "string") updates.description = body.description.trim().slice(0, 2000);
    if (body.amount !== undefined && body.amount !== null) {
      const num = Number(body.amount);
      if (Number.isFinite(num) && num > 0 && num <= 1_000_000_000) updates.amount = Math.round(num * 100) / 100;
    }
    if (typeof body.dueDate === "string") updates.dueDate = body.dueDate.slice(0, 100);

    const result = await db.editMilestone(projectId, milestoneId, updates);
    if (!result) throw new DomainError(404, "Milestone not found", "NOT_FOUND");

    return NextResponse.json({
      success: true,
      message: "Milestone updated successfully",
      milestone: result.milestone,
      project: result.project,
    });
  } catch (err) {
    return errorResponse(err, "Failed to update milestone");
  }
}
