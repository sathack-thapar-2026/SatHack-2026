import { NextRequest, NextResponse } from "next/server";
import { generateInvoiceWithAI, hasGeminiKey, GenerateInvoiceInput } from "@/server/gemini";
import { db } from "@/server/db";
import { assertParticipant, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId : "";

    if (!projectId || !milestoneId) {
      throw new DomainError(400, "projectId and milestoneId are required");
    }

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
    assertParticipant(project, caller);

    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new DomainError(404, "Milestone not found", "NOT_FOUND");

    // An invoice certifies a payment, so it is only produced from the verified server-side record.
    // Caller-supplied invoice data (amounts, transaction ids, dates) is never used.
    if (milestone.status !== "paid") {
      throw new DomainError(409, "An invoice is available once the milestone has been paid.", "NOT_PAID");
    }

    const invoiceInput: GenerateInvoiceInput = {
      projectId: project.id,
      projectTitle: project.title,
      projectDescription: project.description,
      category: project.category,
      client: {
        name: project.client.name,
        email: project.client.email,
        company: project.client.company,
        milestoneOSId: project.client.milestoneOSId,
      },
      freelancer: {
        name: project.freelancer.name,
        email: project.freelancer.email,
        title: project.freelancer.title,
        milestoneOSId: project.freelancer.milestoneOSId,
      },
      milestone: {
        id: milestone.id,
        stageNumber: milestone.stageNumber,
        title: milestone.title,
        description: milestone.description,
        amount: milestone.amount,
        currency: milestone.currency || project.currency || "USD",
        dueDate: milestone.dueDate,
        paidAt: milestone.paidAt,
        acceptanceCriteria: milestone.acceptanceCriteria,
        submissions: milestone.submissions,
      },
      payment: {
        transactionId: milestone.transactionId,
        paidAt: milestone.paidAt,
        amount: milestone.amount,
        currency: milestone.currency || project.currency || "USD",
        status: "completed",
        method: "Secure Milestone Settlement",
      },
    };

    const invoice = await generateInvoiceWithAI(invoiceInput);

    return NextResponse.json({
      success: true,
      invoice,
      hasLiveKey: hasGeminiKey(),
    });
  } catch (err) {
    return errorResponse(err, "Failed to generate AI invoice");
  }
}
