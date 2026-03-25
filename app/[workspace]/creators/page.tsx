import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function CreatorsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Blogueiras"
      title="Base de criadoras"
      highlights={[
        'Perfis organizados com status e notas curtas.',
        'Visao simples para briefing e alinhamento.',
        'Espaco preparado para metricas e historico.'
      ]}
    />
  );
}
