import { NextRequest, NextResponse } from "next/server";
import {
  buildCustomId,
  capturePaymentOrder,
  getPaymentOrder,
  CaptureOrderResult,
} from "@/server/payments";
import { db, PAYABLE_MILESTONE_STATUSES } from "@/server/db";
import { assertClient, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId : "";

    if (!orderId || !projectId || !milestoneId) {
      throw new DomainError(400, "orderId, projectId, and milestoneId are required");
    }

    // 1. Verify project, caller and milestone against the server-side contract
    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found in contract database", "NOT_FOUND");

    assertClient(project, caller, "Unauthorized. Only the designated client can capture payments for this project.");

    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new DomainError(404, "Milestone not found in project", "NOT_FOUND");

    const contractCurrency = (milestone.currency || project.currency || "USD").toUpperCase();
    const expectedAmount = milestone.amount;

    // 2. Inspect the order BEFORE moving any money: it must be for exactly this milestone and price.
    const order = await getPaymentOrder(orderId);

    if (order.customId !== buildCustomId(projectId, milestoneId) || order.referenceId !== milestoneId) {
      console.warn(`Order ${orderId} does not belong to ${projectId}:${milestoneId} (custom_id=${order.customId})`);
      throw new DomainError(403, "This payment order does not match the requested milestone contract.", "ORDER_MISMATCH");
    }
    if (order.currency !== contractCurrency || Math.round(order.amount * 100) !== Math.round(expectedAmount * 100)) {
      console.warn(
        `Order ${orderId} amount mismatch: expected ${expectedAmount} ${contractCurrency}, order ${order.amount} ${order.currency}`
      );
      throw new DomainError(400, "The payment order does not match the milestone's agreed contract price.", "AMOUNT_MISMATCH");
    }

    // 3. Already settled? Succeed idempotently only for the very same capture.
    if (milestone.status === "paid") {
      if (order.capture && milestone.transactionId === order.capture.captureId) {
        return NextResponse.json({
          success: true,
          capture: order.capture,
          project,
          message: "Payment was already recorded.",
        });
      }
      throw new DomainError(400, "Milestone has already been paid and settled.", "ALREADY_PAID");
    }
    if (!PAYABLE_MILESTONE_STATUSES.includes(milestone.status)) {
      throw new DomainError(409, "Approve the delivered work before releasing payment for this milestone.", "NOT_APPROVED");
    }

    // 4. Capture (or reuse the existing capture if the buyer-approved order was already captured)
    let captureResult: CaptureOrderResult;
    if (order.orderStatus === "COMPLETED" && order.capture) {
      captureResult = order.capture;
    } else if (order.orderStatus === "APPROVED") {
      captureResult = await capturePaymentOrder(orderId);
    } else {
      throw new DomainError(400, "The payment has not been approved by the buyer yet.", "NOT_APPROVED_BY_BUYER");
    }

    // 5. Strict status verification: must be COMPLETED
    if (captureResult.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error:
            captureResult.status === "PENDING"
              ? "The payment is still pending with the payment provider and has not been recorded yet."
              : "The payment capture did not complete. No funds were recorded.",
          details: { status: captureResult.status },
        },
        { status: captureResult.status === "PENDING" ? 202 : 400 }
      );
    }

    // 6. Post-capture sanity check (defence in depth)
    if (
      captureResult.currency.toUpperCase() !== contractCurrency ||
      Math.round(captureResult.amount * 100) !== Math.round(expectedAmount * 100)
    ) {
      console.error(
        `Captured amount mismatch for order ${orderId}: expected ${expectedAmount} ${contractCurrency}, captured ${captureResult.amount} ${captureResult.currency}`
      );
      throw new DomainError(
        409,
        `The captured amount did not match the milestone price. Please contact support with order ${orderId}.`,
        "CAPTURE_MISMATCH"
      );
    }

    // 7. Record the verified capture (idempotent)
    const updated = await db.recordPayment(projectId, milestoneId, captureResult);
    if (!updated) throw new DomainError(404, "Project not found in contract database", "NOT_FOUND");

    return NextResponse.json({
      success: true,
      capture: captureResult,
      transaction: updated.transaction,
      project: updated.project,
    });
  } catch (err) {
    return errorResponse(err, "Failed to capture payment");
  }
}
