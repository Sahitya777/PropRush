import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

const app = express();
const PORT = 3000;

// Lazy Stripe initialization to prevent crashes when API key is not yet set
let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === "" || key === "sk_test_..." || key === "sk_live_...") {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// In-memory record for sandbox/test transactions when testing without API key
const sandboxSessions = new Map<string, {
  id: string;
  amount: number;
  paid: boolean;
  userId: string;
  userEmail?: string;
  createdAt: number;
}>();

// Standard JSON parsing for API routes
app.use(express.json());

// ==========================================
// 1. HEALTH & STATUS ENDPOINTS
// ==========================================
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/api/stripe/status", (_req: Request, res: Response) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const isKeyConfigured = Boolean(
    secretKey && 
    secretKey.trim() !== "" && 
    secretKey !== "sk_test_..." && 
    secretKey !== "sk_live_..."
  );

  const mode = isKeyConfigured 
    ? (secretKey?.startsWith("sk_live_") ? "live" : "test") 
    : "sandbox_ready";

  res.json({
    configured: isKeyConfigured,
    mode,
    publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || null,
    message: isKeyConfigured
      ? `Stripe is active in ${mode.toUpperCase()} mode.`
      : "Stripe is ready. Add STRIPE_SECRET_KEY in Settings for real card processing, or use built-in instant test checkout.",
  });
});

// ==========================================
// 2. CREATE CHECKOUT SESSION
// ==========================================
app.post("/api/stripe/create-checkout-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, userId, username, userEmail, returnUrl } = req.body;
    
    const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: "Invalid deposit amount. Must be a positive number." });
      return;
    }

    const host = req.get("host") || `localhost:${PORT}`;
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const baseUrl = returnUrl || `${protocol}://${host}`;

    const stripe = getStripe();

    if (stripe) {
      // REAL STRIPE CHECKOUT SESSION
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
              unit_amount: Math.round(parsedAmount * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        client_reference_id: userId || "guest_player",
        customer_email: userEmail && userEmail.includes("@") ? userEmail : undefined,
        metadata: {
          userId: userId || "guest_player",
          username: username || "Player",
          depositAmount: parsedAmount.toString(),
          app: "PropRush",
        },
        success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&deposit_success=true&amount=${parsedAmount}`,
        cancel_url: `${baseUrl}/?deposit_canceled=true`,
      });

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url,
        mode: "stripe",
      });
      return;
    }

    // SANDBOX / TEST MODE FALLBACK (When STRIPE_SECRET_KEY is not yet added in environment)
    const simulatedSessionId = `cs_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sandboxSessions.set(simulatedSessionId, {
      id: simulatedSessionId,
      amount: parsedAmount,
      paid: true,
      userId: userId || "guest_player",
      userEmail: userEmail || "player@example.com",
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      sessionId: simulatedSessionId,
      url: `${baseUrl}/?session_id=${simulatedSessionId}&deposit_success=true&amount=${parsedAmount}&mode=sandbox`,
      mode: "sandbox",
      message: "Sandbox test session created. Add STRIPE_SECRET_KEY to .env / Settings for live Stripe cards.",
    });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    res.status(500).json({
      error: error.message || "Failed to create Stripe checkout session",
    });
  }
});

// ==========================================
// 3. VERIFY SESSION / PAYMENT CONFIRMATION
// ==========================================
app.get("/api/stripe/verify-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "sessionId parameter is required" });
      return;
    }

    // Check sandbox records first
    if (sessionId.startsWith("cs_sandbox_")) {
      const record = sandboxSessions.get(sessionId);
      if (record) {
        res.json({
          success: true,
          paid: record.paid,
          amount: record.amount,
          currency: "usd",
          customerEmail: record.userEmail,
          userId: record.userId,
          mode: "sandbox",
        });
        return;
      }
    }

    const stripe = getStripe();
    if (!stripe) {
      res.json({
        success: true,
        paid: true,
        amount: parseFloat(req.query.amount as string) || 20,
        currency: "usd",
        mode: "sandbox_unverified",
      });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.payment_status === "paid" || session.status === "complete";
    const amountTotal = (session.amount_total ? session.amount_total / 100 : 0);

    res.json({
      success: true,
      paid: isPaid,
      amount: amountTotal,
      currency: session.currency || "usd",
      customerEmail: session.customer_details?.email || session.customer_email,
      metadata: session.metadata,
      mode: "stripe",
    });
  } catch (error: any) {
    console.error("Error verifying Stripe session:", error);
    res.status(500).json({
      error: error.message || "Failed to verify Stripe checkout session",
    });
  }
});

// ==========================================
// 4. VITE MIDDLEWARE (Full-Stack Express + Vite)
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PropRush Full-Stack Server with Stripe running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
