import { LegalPage } from '@/components/legal/legal-page';

export const metadata = {
  title: 'Data Deletion'
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Data Deletion"
      title="Data Deletion Instructions – Creator IA"
      description="If you want your data removed from Creator IA, you can request deletion by email."
      sections={[
        {
          title: 'How To Request Deletion',
          body: (
            <>
              <p>Send an email to:</p>
              <p className="font-medium text-foreground">rodrigomoreno.pessoal@gmail.com</p>
              <p>Include the subject:</p>
              <p className="font-medium text-foreground">Data Deletion Request – Creator IA</p>
            </>
          )
        },
        {
          title: 'Deletion Timeline',
          body: <p>Your data will be deleted within 7 business days.</p>
        }
      ]}
    />
  );
}
