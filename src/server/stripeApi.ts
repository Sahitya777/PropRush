import type { IncomingMessage, ServerResponse } from "http";
import Stripe from "stripe";

// In-memory record for sandbox/test transactions
const sandboxSessions = new Map<string, {
  id: string;
  amount: number;
  paid: boolean;
  userId: string;
  userEmail?: string;
  createdAt: number;
}>();

let stripeClient: Stripe | null = null;

export function getStripeInstance(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === "" || key.startsWith("sk_test_placeholder") || key === "sk_test_..." || key === "sk_live_...") {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function handleStripeStatus(): {
  configured: boolean;
  mode: 'live' | 'test' | 'sandbox_ready';
  publishableKey: string | null;
  message: string;
} {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const isKeyConfigured = Boolean(
    secretKey && 
    secretKey.trim() !== "" && 
    !secretKey.startsWith("sk_test_placeholder") &&
    secretKey !== "sk_test_..." && 
    secretKey !== "sk_live_..."
  );

  const mode = isKeyConfigured 
    ? (secretKey?.startsWith("sk_live_") ? "live" : "test") 
    : "sandbox_ready";

  return {
    configured: isKeyConfigured,
    mode,
    publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || null,
    message: isKeyConfigured
      ? `Stripe is active in ${mode.toUpperCase()} mode.`
      : "Stripe is ready. Add STRIPE_SECRET_KEY in Settings for real card processing, or use built-in instant test checkout.",
  };
}

export async function handleCreateCheckoutSession(body: {
  amount: number | string;
  userId?: string;
  username?: string;
  userEmail?: string;
  returnUrl?: string;
}, hostHeader?: string, protocolHeader?: string): Promise<any> {
  const parsedAmount = typeof body.amount === "number" ? body.amount : parseFloat(body.amount as string);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid deposit amount. Must be a positive number.");
  }

  const host = hostHeader || "localhost:3000";
  const protocol = protocolHeader || "https";
  const rawBase = body.returnUrl || `${protocol}://${host}`;
  const baseUrl = rawBase.replace(/\/+$/, '');

  const stripe = getStripeInstance();

  if (stripe) {
    // REAL STRIPE CHECKOUT
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "PropRush Wager & Wallet Deposit ($ USD)",
              description: `Instant deposit into PropRush account wallet for multiplayer real-estate matches.`,
              images: [
                "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=400&q=80"
              ],
            },
            unit_amount: Math.round(parsedAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      client_reference_id: body.userId || "guest_player",
      customer_email: body.userEmail && body.userEmail.includes("@") ? body.userEmail : undefined,
      metadata: {
        userId: body.userId || "guest_player",
        username: body.username || "Player",
        depositAmount: parsedAmount.toString(),
        app: "PropRush",
      },
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&deposit_success=true&amount=${parsedAmount}`,
      cancel_url: `${baseUrl}/?deposit_canceled=true`,
    });

    return {
      success: true,
      sessionId: session.id,
      url: session.url,
      mode: "stripe",
    };
  }

  // SANDBOX SIMULATION
  const simulatedSessionId = `cs_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  sandboxSessions.set(simulatedSessionId, {
    id: simulatedSessionId,
    amount: parsedAmount,
    paid: true,
    userId: body.userId || "guest_player",
    userEmail: body.userEmail || "player@example.com",
    createdAt: Date.now(),
  });

  return {
    success: true,
    sessionId: simulatedSessionId,
    url: `${baseUrl}/?session_id=${simulatedSessionId}&deposit_success=true&amount=${parsedAmount}&mode=sandbox`,
    mode: "sandbox",
    message: "Sandbox test session created. Add STRIPE_SECRET_KEY to .env / Settings for live Stripe cards.",
  };
}

export async function handleVerifySession(sessionId: string, amountFallback?: number): Promise<any> {
  if (!sessionId) {
    throw new Error("sessionId parameter is required");
  }

  if (sessionId.startsWith("cs_sandbox_")) {
    const record = sandboxSessions.get(sessionId);
    if (record) {
      return {
        success: true,
        paid: record.paid,
        amount: record.amount,
        currency: "usd",
        customerEmail: record.userEmail,
        userId: record.userId,
        mode: "sandbox",
      };
    }
  }

  const stripe = getStripeInstance();
  if (!stripe) {
    return {
      success: true,
      paid: true,
      amount: amountFallback || 20,
      currency: "usd",
      mode: "sandbox_unverified",
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const isPaid = session.payment_status === "paid" || session.status === "complete";
  const amountTotal = (session.amount_total ? session.amount_total / 100 : 0);

  return {
    success: true,
    paid: isPaid,
    amount: amountTotal,
    currency: session.currency || "usd",
    customerEmail: session.customer_details?.email || session.customer_email,
    metadata: session.metadata,
    mode: "stripe",
  };
}

// Vite Connect middleware helper
export function viteStripeMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url || "";
  
  if (url === "/api/health" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }

  if (url.startsWith("/api/stripe/status") && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(handleStripeStatus()));
    return;
  }

  if (url.startsWith("/api/stripe/create-checkout-session") && req.method === "POST") {
    let bodyData = "";
    req.on("data", (chunk) => {
      bodyData += chunk;
    });
    req.on("end", async () => {
      try {
        const body = bodyData ? JSON.parse(bodyData) : {};
        const host = req.headers.host;
        const proto = (req.headers["x-forwarded-proto"] as string) || "https";
        const result = await handleCreateCheckoutSession(body, host, proto);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: err.message || "Failed to create session" }));
      }
    });
    return;
  }

  if (url.startsWith("/api/stripe/verify-session") && req.method === "GET") {
    const parsedUrl = new URL(url, "http://localhost");
    const sessionId = parsedUrl.searchParams.get("sessionId") || "";
    const amountStr = parsedUrl.searchParams.get("amount");
    const amountFallback = amountStr ? parseFloat(amountStr) : undefined;

    handleVerifySession(sessionId, amountFallback)
      .then((data) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      })
      .catch((err) => {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  next();
}
