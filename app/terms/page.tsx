import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Terms of Service'
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of Service – Creator IA"
      description="By using Creator IA, you agree to use the platform only for lawful purposes."
      sections={[
        {
          title: 'Use of the Service',
          body: (
            <>
              <p>Creator IA provides tools for content creation, organization, and AI assistance.</p>
              <p>We are not responsible for how users use generated content.</p>
            </>
          )
        },
        {
          title: 'Account Conduct',
          body: (
            <>
              <p>Accounts may be suspended if they violate platform rules or applicable laws.</p>
              <p>The service is provided &quot;as is&quot; without guarantees of uptime or results.</p>
            </>
          )
        },
        {
          title: 'Support',
          body: (
            <>
              <p>For support, contact:</p>
              <p className="font-medium text-foreground">rodrigomoreno.pessoal@gmail.com</p>
            </>
          )
        }
      ]}
    />
  );
}
