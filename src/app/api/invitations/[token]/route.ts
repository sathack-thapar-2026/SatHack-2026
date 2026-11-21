import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { callerIsProposer, callerIsRecipient, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import { formatClientId, formatFreelancerId } from "@/lib/dashboard-data";

/**
 * Viewing an invitation only needs the (unguessable) link token — that is what makes
 * "share a private link" work for people who are not signed in yet.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const project = await db.getProjectByInvitationToken(token);

    if (!project) {
      return NextResponse.json(
        { error: "Invitation not found or invalid link." },
        { status: 404 }
      );
    }

    if (project.invitationStatus === "revoked") {
      return NextResponse.json(
        {
          error: "This invitation link was revoked by the sender.",
          status: "revoked",
          projectTitle: project.title,
        },
        { status: 410 }
      );
    }

    const isExpired =
      project.invitationStatus === "expired" ||
      (project.invitationExpiresAt && new Date(project.invitationExpiresAt).getTime() < Date.now());

    if (isExpired && project.invitationStatus !== "claimed") {
      return NextResponse.json(
        {
          error: "This invitation link has expired.",
          status: "expired",
          projectTitle: project.title,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
      invitation: {
        token: project.invitationToken,
        status: project.invitationStatus || "active",
        expiresAt: project.invitationExpiresAt,
        initiatedByRole: project.initiatedBy,
        senderName:
          project.initiatedBy === "client" ? project.client.name : project.freelancer.name,
        senderOrgOrTitle:
          project.initiatedBy === "client" ? project.client.company : project.freelancer.title,
        senderMilestoneOSId:
          project.initiatorMilestoneOSId ||
          (project.initiatedBy === "client"
            ? project.client.milestoneOSId
            : project.freelancer.milestoneOSId),
      },
    });
  } catch (err) {
    return errorResponse(err, "Failed to fetch invitation");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Accepting or revoking changes a contract, so it needs a verified signed-in user.
    const caller = await requireCaller(req);
    const { token } = await params;
    const body = await readJson(req);
    const action: string = typeof body.action === "string" ? body.action : "accept";

    const project = await db.getProjectByInvitationToken(token);
    if (!project) throw new DomainError(404, "Invitation not found.", "NOT_FOUND");

    const isProposer = callerIsProposer(project, caller);

    if (action === "revoke") {
      if (!isProposer) {
        throw new DomainError(403, "Only the sender of this proposal can revoke its invitation link.", "FORBIDDEN");
      }
      const ok = await db.revokeInvitation(token);
      if (!ok) throw new DomainError(404, "Invitation not found.", "NOT_FOUND");
      return NextResponse.json({ success: true, message: "Invitation link revoked." });
    }

    if (project.invitationStatus === "revoked") {
      throw new DomainError(410, "This invitation has been revoked.", "REVOKED");
    }

    if (action === "accept") {
      if (isProposer) {
        throw new DomainError(400, "You created this proposal. You cannot accept your own invitation.", "SELF_ACCEPT");
      }
      // A proposal addressed to a specific registered user can only be accepted by that user.
      if (!project.isPublicInvitation && !callerIsRecipient(project, caller)) {
        throw new DomainError(403, "This proposal was addressed to a different account.", "FORBIDDEN");
      }

      // The claimer's details come from their verified profile — never from the request body.
      const clientSent = project.initiatedBy === "client";
      const claimed = await db.claimInvitation(token, {
        id: caller.id,
        name: caller.name,
        email: caller.email,
        avatar: caller.avatar,
        milestoneOSId: clientSent ? formatFreelancerId(caller.baseCode) : formatClientId(caller.baseCode),
        role: clientSent ? "freelancer" : "client",
        companyOrTitle: clientSent ? caller.title : caller.company,
      });
      if (!claimed) throw new DomainError(404, "Invitation not found.", "NOT_FOUND");

      return NextResponse.json({
        success: true,
        message: "Invitation accepted. Project contract is now active.",
        project: claimed,
      });
    }

    if (action === "request_changes" || action === "reject") {
      throw new DomainError(
        400,
        "Invitation links can only be accepted or revoked. Use the project request screen to review, request changes, or decline.",
        "UNSUPPORTED_ACTION"
      );
    }

    throw new DomainError(400, "Unknown action", "UNKNOWN_ACTION");
  } catch (err) {
    return errorResponse(err, "Failed to process invitation action");
  }
}
