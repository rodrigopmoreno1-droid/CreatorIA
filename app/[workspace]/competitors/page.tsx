import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function CompetitorsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Concorrentes"
      title="Mapa de referencias"
      highlights={[
        'Anotacoes e repertorio visual do que performa melhor.',
        'Espaco para insights curtos e sem ruido.',
        'Preparado para crescer com IA depois.'
      ]}
    />
  );
}
