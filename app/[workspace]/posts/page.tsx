import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function PostsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Postagens"
      title="Planejamento de publicacao"
      highlights={[
        'Separar feed, reels e stories sem misturar tudo.',
        'Manter status claros de revisao, agendamento e publicado.',
        'Preparar espaco para calendario e automacoes.'
      ]}
    />
  );
}
