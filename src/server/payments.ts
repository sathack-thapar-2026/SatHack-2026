/**
 * PerMile — Payment Gateway Server Client
 * Orders v2 REST integration for server-side order creation, inspection and capture.
 * Gateway error bodies are logged server-side only; callers receive generic messages.
 */

import { DomainError } from "./errors";
import { SUPPORTED_CHECKOUT_CURRENCIES } from "@/lib/dashboard-data";

interface GatewayTokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: GatewayTokenCache | null = null;

export function getGatewayBaseUrl(): string {
  const env = process.env.PAYPAL_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function hasPaymentCredentials(): boolean {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientSecret &&
    clientId !== "your_paypal_sandbox_client_id_here" &&
    clientSecret !== "your_paypal_sandbox_client_secret_here"
  );
}

function assertConfigured() {
  if (!hasPaymentCredentials()) {
    throw new DomainError(
      503,
      "Payment gateway credentials are not configured on the server.",
      "GATEWAY_NOT_CONFIGURED"
    );
  }
}

/** Gateway currencies we allow, and how many decimals each uses. */
export function isSupportedCheckoutCurrency(currency: string): boolean {
  return SUPPORTED_CHECKOUT_CURRENCIES.includes(currency.toUpperCase());
}

export function formatGatewayAmount(amount: number, currency: string): string {
  // All currently supported checkout currencies use 2 decimals.
  void currency;
  return amount.toFixed(2);
}

/** Identifier stored on the order so a capture can be matched back to one exact milestone. */
export function buildCustomId(projectId: string, milestoneId: string): string {
  return `${projectId}:${milestoneId}`
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 127);
}

/**
 * Retrieves or refreshes OAuth2 Bearer Access Token from the gateway
 */
export async function getGatewayAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  assertConfigured();
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = getGatewayBaseUrl();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Payment gateway token request failed (${response.status}): ${errorText}`);
    throw new DomainError(502, "Could not authenticate with the payment gateway.", "GATEWAY_AUTH");
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 32400) * 1000,
  };

  return tokenCache.accessToken;
}

export interface CreateOrderParams {
  projectId: string;
  milestoneId: string;
  milestoneTitle: string;
  amount: number;
  currency?: string;
  freelancerName?: string;
  /** Public address of this app, used for checkout return links. */
  appUrl?: string;
}

export interface PaymentOrderResult {
  orderId: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  approvalUrl?: string;
  isSimulated?: boolean;
}

/**
 * Creates a payment order for a milestone payment
 */
export async function createPaymentOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
  const { projectId, milestoneId, milestoneTitle, amount, currency = "USD" } = params;

  assertConfigured();
  if (!isSupportedCheckoutCurrency(currency)) {
    throw new DomainError(400, `Checkout does not support ${currency}.`, "UNSUPPORTED_CURRENCY");
  }

  const token = await getGatewayAccessToken();
  const baseUrl = getGatewayBaseUrl();

  // Ensure ASCII-only string values for hosted checkout UI compatibility
  const cleanTitle = (milestoneTitle || "Milestone Payment")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 90);
  const cleanDescription = `PerMile: ${cleanTitle}`
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 127);

  const appUrl = params.appUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: milestoneId,
        description: cleanDescription,
        custom_id: buildCustomId(projectId, milestoneId),
        amount: {
          currency_code: currency.toUpperCase(),
          value: formatGatewayAmount(amount, currency),
        },
      },
    ],
    application_context: {
      brand_name: "PerMile",
      landing_page: "NO_PREFERENCE",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      return_url: `${appUrl}/dashboard?payment=success&milestoneId=${encodeURIComponent(milestoneId)}`,
      cancel_url: `${appUrl}/dashboard?payment=cancelled`,
    },
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": `order_${projectId}_${milestoneId}_${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to create payment order (${response.status}): ${errorText}`);
    throw new DomainError(502, "The payment gateway could not create the order. Please try again.", "GATEWAY_ORDER");
  }

  const data = await response.json();
  console.log(
    `[Payments] Created order ${data.id} (${data.status}) for ${formatGatewayAmount(amount, currency)} ${currency} - ref: ${milestoneId}`
  );
  const approveLink = data.links?.find((l: { rel: string; href: string }) => l.rel === "approve");

  return {
    orderId: data.id,
    status: data.status,
    approvalUrl: approveLink?.href,
    isSimulated: false,
  };
}

export interface CaptureOrderResult {
  captureId: string;
  orderId: string;
  status: "COMPLETED" | "FAILED" | "PENDING";
  amount: number;
  currency: string;
  payerEmail?: string;
  payerName?: string;
  payerId?: string;
  customId?: string;
  referenceId?: string;
  timestamp: string;
  isSimulated?: boolean;
}

export interface PaymentOrderDetails {
  orderId: string;
  /** Order-level status: CREATED | APPROVED | COMPLETED | VOIDED | PAYER_ACTION_REQUIRED ... */
  orderStatus: string;
  customId?: string;
  referenceId?: string;
  /** Amount/currency the order was created for. */
  amount: number;
  currency: string;
  /** Present once the order has been captured. */
  capture?: CaptureOrderResult;
}

function parseOrder(data: any): PaymentOrderDetails {
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  const orderAmount = parseFloat(purchaseUnit?.amount?.value || "0");
  const orderCurrency = (purchaseUnit?.amount?.currency_code || "USD").toUpperCase();

  let parsedCapture: CaptureOrderResult | undefined;
  if (capture) {
    const captureCompleted = capture.status === "COMPLETED";
    parsedCapture = {
      captureId: capture.id,
      orderId: data.id,
      status: captureCompleted ? "COMPLETED" : capture.status === "PENDING" ? "PENDING" : "FAILED",
      amount: parseFloat(capture.amount?.value || purchaseUnit?.amount?.value || "0"),
      currency: (capture.amount?.currency_code || orderCurrency).toUpperCase(),
      payerEmail: data.payer?.email_address,
      payerName: data.payer?.name
        ? `${data.payer.name.given_name || ""} ${data.payer.name.surname || ""}`.trim()
        : undefined,
      payerId: data.payer?.payer_id,
      customId: purchaseUnit?.custom_id,
      referenceId: purchaseUnit?.reference_id,
      timestamp: capture.create_time || new Date().toISOString(),
      isSimulated: false,
    };
  }

  return {
    orderId: data.id,
    orderStatus: data.status,
    customId: purchaseUnit?.custom_id,
    referenceId: purchaseUnit?.reference_id,
    amount: orderAmount,
    currency: orderCurrency,
    capture: parsedCapture,
  };
}

/**
 * Looks up an order WITHOUT moving any money, so it can be validated before capture.
 */
export async function getPaymentOrder(orderId: string): Promise<PaymentOrderDetails> {
  assertConfigured();
  if (!/^[A-Za-z0-9_-]{5,64}$/.test(orderId)) {
    throw new DomainError(400, "Invalid payment order id.", "BAD_ORDER");
  }

  const token = await getGatewayAccessToken();
  const baseUrl = getGatewayBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to load payment order ${orderId} (${response.status}): ${errorText}`);
    throw new DomainError(
      response.status === 404 ? 404 : 502,
      response.status === 404 ? "Payment order not found." : "Could not verify the payment order. Please try again.",
      "GATEWAY_LOOKUP"
    );
  }

  return parseOrder(await response.json());
}

/**
 * Captures funds from an approved order. Only call this after getPaymentOrder() validated it.
 */
export async function capturePaymentOrder(orderId: string): Promise<CaptureOrderResult> {
  assertConfigured();
  if (!/^[A-Za-z0-9_-]{5,64}$/.test(orderId)) {
    throw new DomainError(400, "Invalid payment order id.", "BAD_ORDER");
  }

  const token = await getGatewayAccessToken();
  const baseUrl = getGatewayBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": `capture_${orderId}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to capture payment order ${orderId} (${response.status}): ${errorText}`);
    // Already captured (e.g. a retry after a dropped response): recover from the order itself.
    if (response.status === 422 && errorText.includes("ORDER_ALREADY_CAPTURED")) {
      const existing = await getPaymentOrder(orderId);
      if (existing.capture) return existing.capture;
    }
    throw new DomainError(502, "The payment could not be captured. No funds were recorded.", "GATEWAY_CAPTURE");
  }

  const parsed = parseOrder(await response.json());
  if (!parsed.capture) {
    return {
      captureId: parsed.orderId,
      orderId: parsed.orderId,
      status: "FAILED",
      amount: parsed.amount,
      currency: parsed.currency,
      customId: parsed.customId,
      referenceId: parsed.referenceId,
      timestamp: new Date().toISOString(),
      isSimulated: false,
    };
  }
  return parsed.capture;
}
