import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: 'Stripe webhook endpoint ready. Configure STRIPE_WEBHOOK_SECRET to validate signatures.'
  });
}
