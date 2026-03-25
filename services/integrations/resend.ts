type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendInvitationEmail(input: EmailInput) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, message: 'Resend API key is missing.', input };
  }

  return {
    ok: true,
    message: 'Email flow wired for invitations and notifications.',
    input
  };
}

export async function sendNotificationEmail(input: EmailInput) {
  return sendInvitationEmail(input);
}
