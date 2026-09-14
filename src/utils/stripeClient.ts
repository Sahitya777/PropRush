export interface StripeStatus {
  configured: boolean;
  mode: 'live' | 'test' | 'sandbox_ready';
  publishableKey: string | null;
  message: string;
}

export interface CheckoutSessionResponse {
  success: boolean;
  sessionId?: string;
  url?: string;
  mode?: 'stripe' | 'sandbox';
  error?: string;
  message?: string;
}

export interface VerifySessionResponse {
  success: boolean;
  paid: boolean;
  amount: number;
  currency?: string;
  customerEmail?: string;
  mode?: string;
  error?: string;
}

export async function fetchStripeStatus(): Promise<StripeStatus> {
  try {
    const res = await fetch('/api/stripe/status');
    if (!res.ok) throw new Error('Failed to get stripe status');
    return await res.json();
  } catch (err) {
    return {
      configured: false,
      mode: 'sandbox_ready',
      publishableKey: null,
      message: 'Running local test gateway. Add STRIPE_SECRET_KEY in Settings to enable live Stripe checkout.'
    };
  }
}

export async function createStripeCheckoutSession(params: {
  amount: number;
  userId?: string;
  username?: string;
  userEmail?: string;
  returnUrl?: string;
}): Promise<CheckoutSessionResponse> {
  try {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      let errorMsg = `Payment server error (${res.status})`;
      try {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json?.error) errorMsg = json.error;
        } catch {
          if (text.includes("FUNCTION_INVOCATION_FAILED") || text.includes("A server error has occurred")) {
            errorMsg = "Payment gateway is booting up. Please retry in a moment.";
          }
        }
      } catch {
        // fallback
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  } catch (error: any) {
    console.error('Error creating Stripe session:', error);
    return {
      success: false,
      error: error.message || 'Payment server connection failed',
    };
  }
}

export async function verifyStripeSession(sessionId: string, amount?: number): Promise<VerifySessionResponse> {
  try {
    const query = new URLSearchParams({ sessionId });
    if (amount) query.set('amount', amount.toString());
    const res = await fetch(`/api/stripe/verify-session?${query.toString()}`);
    
    if (!res.ok) {
      let errorMsg = `Payment verification failed (${res.status})`;
      try {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json?.error) errorMsg = json.error;
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Error verifying Stripe session:', error);
    return {
      success: false,
      paid: false,
      amount: 0,
      error: error.message,
    };
  }
}
