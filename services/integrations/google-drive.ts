type DriveUploadInput = {
  name: string;
  mimeType?: string;
  contentUrl?: string;
  folderId?: string;
};

export async function uploadToGoogleDrive(input: DriveUploadInput) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return {
      ok: false,
      message: 'Google Drive credentials are missing.',
      input
    };
  }

  return {
    ok: true,
    message: 'Google Drive integration is wired and ready for OAuth + upload flow.',
    input
  };
}

export async function listGoogleDriveFiles() {
  return {
    ok: true,
    files: [
      { name: 'Campanha Verão', id: 'drive-file-1', mimeType: 'video/mp4' },
      { name: 'Story Frames', id: 'drive-file-2', mimeType: 'image/png' }
    ]
  };
}

export function buildDriveLink(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
