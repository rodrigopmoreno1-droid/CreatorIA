import { NextResponse } from 'next/server';
import { sendNotificationEmail } from '@/services/integrations/resend';

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'resend',
    data: await sendNotificationEmail({
      to: 'demo@contentos.local',
      subject: 'ContentOS integration check',
      html: '<p>Resend is configured.</p>'
    })
  });
}
