import { NextRequest, NextResponse } from "next/server";
import { createPaymentOrder, isSupportedCheckoutCurrency } from "@/server/payments";
import { db, PAYABLE_MILESTONE_STATUSES } from "@/server/db";
import { assertClient, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    // The payer is ALWAYS the verified signed-in user. Identity in the body/headers is ignored.
    const caller = await requireCaller(req);
    const body = await readJson(req);
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId : "";

    if (!projectId || !milestoneId) {
      throw new DomainError(400, "projectId and milestoneId are required");
    }

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found in contract database", "NOT_FOUND");

    assertClient(
      project,
      caller,
      "Unauthorized. Only the designated client organization can initiate payments for this project."
    );

    if (project.status !== "active") {
      throw new DomainError(409, "Payments can only be made on an active, accepted contract.", "PROJECT_NOT_ACTIVE");
    }

    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new DomainError(404, "Milestone not found in project", "NOT_FOUND");

    if (milestone.status === "paid") {
      throw new DomainError(400, "Milestone has already been paid and settled.", "ALREADY_PAID");
    }
    if (!PAYABLE_MILESTONE_STATUSES.includes(milestone.status)) {
      throw new DomainError(409, "Approve the delivered work before releasing payment for this milestone.", "NOT_APPROVED");
    }

    // Amount is strictly derived from the verified server-side contract.
    // Client-supplied amounts are deliberately ignored to prevent price tampering.
    const contractAmount = milestone.amount;
    const contractCurrency = (milestone.currency || project.currency || "USD").trim().toUpperCase();

    if (!contractAmount || contractAmount <= 0) {
      throw new DomainError(400, "Milestone contract amount must be greater than zero.");
    }

    // Do not silently convert currencies: unsupported currencies must be changed before payment.
    if (!isSupportedCheckoutCurrency(contractCurrency)) {
      const isInr = ["INR", "₹", "RUPEE", "RUPEES"].includes(contractCurrency);
      return NextResponse.json(
        {
          error: isInr
            ? "Secure checkout does not support INR (Indian Rupee) directly. Escrow milestone contracts must be settled in supported currencies (USD). Please adjust the milestone currency to USD."
            : `Secure checkout does not support ${contractCurrency}. Please adjust the milestone currency to USD.`,
          currency: contractCurrency,
          isUnsupportedCurrency: true,
        },
        { status: 400 }
      );
    }

    const orderResult = await createPaymentOrder({
      projectId: project.id,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      amount: contractAmount,
      currency: contractCurrency,
      freelancerName: project.freelancer.name,
    });

    return NextResponse.json({
      success: true,
      order: orderResult,
      milestone: {
        id: milestone.id,
        title: milestone.title,
        amount: contractAmount,
        currency: contractCurrency,
        orderAmount: contractAmount,
        orderCurrency: contractCurrency,
      },
    });
  } catch (err) {
    return errorResponse(err, "Failed to create payment order");
  }
}
