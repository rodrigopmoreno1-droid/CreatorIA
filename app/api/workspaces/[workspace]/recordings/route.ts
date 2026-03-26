import { NextResponse } from 'next/server';

import { getWorkspaceRecordings } from '@/lib/platform-data';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace } = await params;
  const recordings = await getWorkspaceRecordings(workspace);

  return NextResponse.json({ recordings });
}
