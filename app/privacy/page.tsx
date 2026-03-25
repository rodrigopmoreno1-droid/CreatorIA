import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Privacy Policy'
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy – Creator IA"
      description="Creator IA collects and processes user data in order to provide content creation, organization, and AI-powered tools."
      sections={[
        {
          title: 'What We May Collect',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Account information such as name and email.</li>
              <li>Content created inside the platform.</li>
              <li>Connected social media account data, when authorized by the user.</li>
            </ul>
          )
        },
        {
          title: 'How Data Is Used',
          body: (
            <>
              <p>We do not sell personal data.</p>
              <p>Data is used only to provide and improve the service.</p>
            </>
          )
        },
        {
          title: 'Data Requests',
          body: (
            <>
              <p>Users may request data deletion at any time by contacting:</p>
              <p className="font-medium text-foreground">rodrigomoreno.pessoal@gmail.com</p>
              <p>By using Creator IA, you agree to this Privacy Policy.</p>
            </>
          )
        }
      ]}
    />
  );
}
