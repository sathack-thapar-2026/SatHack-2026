/**
 * MilestoneOS — Payment Gateway Server Client
 * Official Orders v2 REST API integration for server-side order creation and capture.
 */

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

/**
 * Retrieves or refreshes OAuth2 Bearer Access Token from the payment gateway
 */
export async function getGatewayAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!hasPaymentCredentials()) {
    throw new Error(
      "Payment gateway credentials missing. Please define the client ID and client secret in .env.local."
    );
  }

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
    throw new Error(`Payment gateway token request failed (${response.status}): ${errorText}`);
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
}

export interface PaymentOrderResult {
  orderId: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  approvalUrl?: string;
  isSimulated?: boolean;
}

/**
 * Creates an authorized Payment Order for a milestone payment
 */
export async function createPaymentOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
  const { projectId, milestoneId, milestoneTitle, amount, currency = "USD" } = params;

  if (!hasPaymentCredentials()) {
    throw new Error(
      "Payment gateway credentials missing. Please configure the client ID and client secret in .env.local."
    );
  }

  const token = await getGatewayAccessToken();
  const baseUrl = getGatewayBaseUrl();

  // Ensure ASCII-only string values for hosted checkout UI compatibility
  const cleanTitle = (milestoneTitle || "Milestone Payment")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 90);
  const cleanDescription = `MilestoneOS: ${cleanTitle}`
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 127);
  const cleanCustomId = `${projectId}:${milestoneId}`
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 127);

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: milestoneId,
        description: cleanDescription,
        custom_id: cleanCustomId,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "MilestoneOS",
      landing_page: "NO_PREFERENCE",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?payment=success&milestoneId=${milestoneId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?payment=cancelled`,
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
    throw new Error(`Failed to create payment order (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log(
    `[Payments API] Created order ${data.id} (${data.status}) for ${amount.toFixed(2)} ${currency} - ref: ${milestoneId}`
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

/**
 * Captures funds from an approved Payment Order
 */
export async function capturePaymentOrder(orderId: string): Promise<CaptureOrderResult> {
  if (!hasPaymentCredentials()) {
    throw new Error(
      "Payment gateway credentials missing. Please configure the client ID and client secret in .env.local."
    );
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
    throw new Error(`Failed to capture payment order (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  const isCompleted =
    data.status === "COMPLETED" && (capture?.status === "COMPLETED" || !capture?.status);

  return {
    captureId: capture?.id || data.id,
    orderId: data.id,
    status: isCompleted ? "COMPLETED" : (capture?.status || "FAILED"),
    amount: parseFloat(capture?.amount?.value || purchaseUnit?.amount?.value || "0"),
    currency: capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code || "USD",
    payerEmail: data.payer?.email_address,
    payerName: data.payer?.name
      ? `${data.payer.name.given_name || ""} ${data.payer.name.surname || ""}`.trim()
      : undefined,
    payerId: data.payer?.payer_id,
    customId: purchaseUnit?.custom_id,
    referenceId: purchaseUnit?.reference_id,
    timestamp: capture?.create_time || new Date().toISOString(),
    isSimulated: false,
  };
}
