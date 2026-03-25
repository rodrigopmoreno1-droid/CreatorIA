import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{
    title: string;
    body: React.ReactNode;
  }>;
};

export function LegalPage({ eyebrow, title, description, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-background px-6 py-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="surface-shell rounded-[28px] p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Creator IA
            </div>
          </div>

          <div className="mt-10 max-w-2xl">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{description}</p>
          </div>

          <div className="mt-10 space-y-4">
            {sections.map((section) => (
              <section key={section.title} className="rounded-xl border border-border bg-white p-5">
                <h2 className="text-[15px] font-semibold text-foreground">{section.title}</h2>
                <div className="mt-3 space-y-3 text-[14px] leading-7 text-muted-foreground">{section.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
