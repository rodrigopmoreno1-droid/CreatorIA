import { SimpleModuleShell } from '@/components/platform/simple-module-shell';

export default function MetricsPage() {
  return (
    <SimpleModuleShell
      eyebrow="Metricas"
      title="Leitura de performance"
      description="A pagina de metricas vai crescer a partir de indicadores realmente uteis para a operacao, sem dashboards poluidos ou grafico desnecessario."
      highlights={[
        'Foco em alcance, views, engajamento e crescimento.',
        'Leitura limpa para decidir o que repetir ou cortar.',
        'Espaco ideal para analises futuras por IA.'
      ]}
    />
  );
}
