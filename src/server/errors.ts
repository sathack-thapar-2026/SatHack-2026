import { NextResponse } from "next/server";

/**
 * Error with an HTTP status that is safe to show to the API caller.
 * Anything that is NOT a DomainError is treated as an unexpected failure:
 * it is logged server-side and the caller only sees a generic message.
 */
export class DomainError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(err: unknown, fallbackMessage: string): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(fallbackMessage, err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

/** Parses a JSON request body; malformed JSON becomes a clean 400 instead of a 500. */
export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
    throw new DomainError(400, "Request body must be a JSON object.");
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError(400, "Invalid JSON request body.");
  }
}
