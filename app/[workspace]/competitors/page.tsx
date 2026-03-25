import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function CompetitorsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Concorrentes"
      title="Mapa de referencias"
      description="Aqui a ideia e enxergar concorrentes como repertorio estrategico da operacao, nao como uma pagina lotada de widgets sem utilidade."
      highlights={[
        'Anotacoes e repertorio visual de quem esta performando melhor.',
        'Espaco para insights curtos, sem ruido visual.',
        'Preparado para crescer com IA e pesquisa manual depois.'
      ]}
    />
  );
}
