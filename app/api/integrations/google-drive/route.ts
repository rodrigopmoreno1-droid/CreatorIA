import { NextResponse } from 'next/server';
import { buildDriveLink, listGoogleDriveFiles } from '@/services/integrations/google-drive';

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'google-drive',
    files: await listGoogleDriveFiles(),
    exampleLink: buildDriveLink('example-file-id')
  });
}
