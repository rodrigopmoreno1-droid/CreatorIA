import { NextResponse } from 'next/server';
import { sendNotificationEmail } from '@/services/integrations/resend';

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'resend',
    data: await sendNotificationEmail({
      to: process.env.RESEND_TEST_EMAIL ?? 'rodrigomoreno.pessoal@gmail.com',
      subject: 'Creator AI integration check',
      html: '<p>Resend is configured for Creator AI.</p>'
    })
  });
}
