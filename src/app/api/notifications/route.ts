import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { assertParticipant, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import { newId } from "@/server/ids";
import type { NotificationItem } from "@/lib/dashboard-data";

const NOTIFICATION_TYPES: NotificationItem["type"][] = [
  "submission",
  "revision",
  "approval",
  "payment",
  "proposal",
  "system",
];

export async function GET(req: NextRequest) {
  try {
    // A user can only ever read their own notifications.
    const caller = await requireCaller(req);
    const notifications = await db.getNotifications({ userId: caller.id });

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    return errorResponse(err, "Failed to fetch notifications");
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);

    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
    if (!title || !message) {
      throw new DomainError(400, "title and message are required");
    }

    const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : undefined;
    let targetUserId = typeof body.userId === "string" && body.userId ? body.userId : caller.id;

    // Notifying somebody else is only allowed for the other participant of a project you belong to.
    if (targetUserId !== caller.id) {
      if (!projectId) {
        throw new DomainError(403, "You can only create notifications for yourself.", "FORBIDDEN");
      }
      const project = await db.getProjectById(projectId);
      if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
      assertParticipant(project, caller);
      if (targetUserId !== project.clientId && targetUserId !== project.freelancerId) {
        throw new DomainError(403, "That user is not part of this project.", "FORBIDDEN");
      }
    } else {
      targetUserId = caller.id;
    }

    const type = NOTIFICATION_TYPES.includes(body.type) ? body.type : "system";
    const item: NotificationItem = {
      id: newId("notif"),
      userId: targetUserId,
      projectId,
      title,
      message,
      type,
      unread: true,
      timestamp: new Date().toISOString(),
      isDemo: false,
    };

    const saved = await db.createNotification(item);
    return NextResponse.json({ success: true, notification: saved });
  } catch (err) {
    return errorResponse(err, "Failed to create notification");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);

    if (body.all === true) {
      await db.markAllNotificationsRead(caller.id);
      return NextResponse.json({ success: true, message: "All notifications marked read" });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new DomainError(400, "id is required");

    // Scoped to the caller: marking someone else's notification read is a silent no-op.
    const ok = await db.markNotificationRead(id, caller.id);
    return NextResponse.json({ success: ok });
  } catch (err) {
    return errorResponse(err, "Failed to update notification");
  }
}
