import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'Creator AI',
    mode: process.env.NODE_ENV,
    providers: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      googleDrive: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      resend: Boolean(process.env.RESEND_API_KEY),
      ai: Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY)
    },
    timestamp: new Date().toISOString()
  });
}
