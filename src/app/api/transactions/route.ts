import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireCaller } from "@/server/auth";
import { errorResponse } from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    // Identity comes ONLY from the verified session token, never from query parameters.
    const caller = await requireCaller(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || undefined;

    const transactions = await db.getTransactions({
      userId: caller.id,
      userEmail: caller.email,
      projectId,
    });

    return NextResponse.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    return errorResponse(err, "Failed to fetch transactions");
  }
}
