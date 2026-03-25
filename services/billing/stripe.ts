import Stripe from 'stripe';

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-06-20' as Stripe.LatestApiVersion
  });
}

export function getBillingConfig() {
  return {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
    priceIds: {
      basic: process.env.STRIPE_PRICE_BASIC ?? '',
      pro: process.env.STRIPE_PRICE_PRO ?? '',
      agency: process.env.STRIPE_PRICE_AGENCY ?? '',
      whiteLabel: process.env.STRIPE_PRICE_WHITE_LABEL ?? ''
    },
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? ''
  };
}

export async function createCheckoutSession() {
  return {
    ok: false,
    message: 'Stripe checkout is stubbed until price ids and secret key are configured.'
  };
}
