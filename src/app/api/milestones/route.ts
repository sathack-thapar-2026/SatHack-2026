import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { assertParticipant, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    if (!projectId || !title || body.amount === undefined || body.amount === null || body.amount === "") {
      throw new DomainError(400, "projectId, title, and amount are required");
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      throw new DomainError(400, "amount must be a positive number");
    }

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
    const roles = assertParticipant(project, caller);

    const criteria: string[] = (Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria : [])
      .filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0)
      .slice(0, 25)
      .map((c: string) => c.trim().slice(0, 300));

    const result = await db.addMilestone(
      projectId,
      {
        title,
        description:
          (typeof body.description === "string" && body.description.trim().slice(0, 2000)) ||
          "Agreed deliverables milestone.",
        amount: Math.round(amount * 100) / 100,
        dueDate: typeof body.dueDate === "string" ? body.dueDate.slice(0, 100) : undefined,
        acceptanceCriteria: criteria,
      },
      { name: caller.name, role: roles.isFreelancer ? "freelancer" : "client" }
    );

    if (!result) throw new DomainError(404, "Project not found", "NOT_FOUND");

    return NextResponse.json({
      success: true,
      message: "Milestone created successfully",
      milestone: result.milestone,
      project: result.project,
    });
  } catch (err) {
    return errorResponse(err, "Failed to create milestone");
  }
}
