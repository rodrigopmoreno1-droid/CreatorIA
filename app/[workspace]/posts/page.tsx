import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function PostsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Postagens"
      title="Planejamento de publicacao"
      description="Aqui vamos organizar os conteudos que ja sairam do fluxo de gravacao e precisam entrar em agendamento, revisao de legenda e checklist final."
      highlights={[
        'Separar feed, reels e stories sem misturar a operacao inteira.',
        'Manter status claros de revisao, agendamento e publicado.',
        'Preparar espaco para calendarios e automacoes depois.'
      ]}
    />
  );
}
