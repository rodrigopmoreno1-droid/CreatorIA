import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function CreatorsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Blogueiras"
      title="Base de criadoras"
      description="Esse modulo vai concentrar perfis, nichos, historico e observacoes para o time tomar decisoes de conteudo e parceria sem perder contexto."
      highlights={[
        'Perfis organizados com status e anotacoes da operacao.',
        'Visao simples para briefing e alinhamento de gravacao.',
        'Espaco preparado para metricas e historico depois.'
      ]}
    />
  );
}
