import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { assertParticipant, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import type { ProjectContract } from "@/lib/dashboard-data";

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireCaller(req);
    const { id } = await params;

    const project = await db.getProjectById(id);
    if (!project) {
      throw new DomainError(404, "Project not found or you are not authorized to view it.", "NOT_FOUND");
    }
    assertParticipant(project, caller);

    return NextResponse.json({ success: true, project });
  } catch (err) {
    return errorResponse(err, "Failed to fetch project");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireCaller(req);
    const { id } = await params;
    const body = await readJson(req);

    const existing = await db.getProjectById(id);
    if (!existing) throw new DomainError(404, "Project not found", "NOT_FOUND");
    assertParticipant(existing, caller);

    // Only plain descriptive fields can be edited here. Money, participants, ids, milestones
    // and workflow state are changed exclusively through their dedicated, rule-checked endpoints.
    const updates: Partial<ProjectContract> = {};

    const title = cleanText(body.title, 200);
    if (title !== undefined) {
      if (!title) throw new DomainError(400, "The project title cannot be empty.");
      updates.title = title;
    }
    const description = cleanText(body.description, 5000);
    if (description !== undefined) updates.description = description;
    const category = cleanText(body.category, 100);
    if (category) updates.category = category;
    const targetDeadline = cleanText(body.targetDeadline, 100);
    if (targetDeadline) updates.targetDeadline = targetDeadline;

    if (body.status !== undefined && body.status !== existing.status) {
      if (body.status === "archived") {
        updates.status = "archived";
      } else if (body.status === "active" && existing.status === "archived" && existing.proposalStatus === "accepted") {
        updates.status = "active"; // restore an archived, previously accepted contract
      } else {
        throw new DomainError(
          400,
          "Project status is managed by the proposal and payment workflow and cannot be set directly.",
          "STATUS_LOCKED"
        );
      }
    }

    const updated = await db.updateProject(id, updates);
    if (!updated) throw new DomainError(404, "Project not found", "NOT_FOUND");

    return NextResponse.json({ success: true, project: updated });
  } catch (err) {
    return errorResponse(err, "Failed to update project");
  }
}
