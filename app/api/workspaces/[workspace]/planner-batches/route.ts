import { after, NextResponse } from 'next/server';

import { processContentPlannerBatch } from '@/lib/content-planner-batches';
import { getWorkspacePlannerBatches, getWorkspaceProducts, resolveWorkspaceDataAccess } from '@/lib/platform-data';
import { generateSchedulePlan, type PlannerConfig } from '@/lib/post-schedule-planner';
import { getAuthenticatedUser } from '@/lib/workspace-server';

function sanitizePlannerConfig(value: unknown): PlannerConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.startDate !== 'string' || typeof raw.endDate !== 'string') {
    return null;
  }

  return {
    mode: raw.mode === 'replan' ? 'replan' : 'create',
    periodPreset:
      raw.periodPreset === '1' ||
      raw.periodPreset === '15' ||
      raw.periodPreset === '30' ||
      raw.periodPreset === 'custom'
        ? raw.periodPreset
        : '7',
    startDate: raw.startDate,
    endDate: raw.endDate,
    feedPerDay:
      typeof raw.feedPerDay === 'number'
        ? raw.feedPerDay
        : Number.parseInt(String(raw.feedPerDay ?? 0), 10) || 0,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    templateId: typeof raw.templateId === 'string' && raw.templateId ? raw.templateId : undefined,
    productRules: Array.isArray(raw.productRules)
      ? raw.productRules
          .filter((rule): rule is PlannerConfig['productRules'][number] => Boolean(rule && typeof rule === 'object'))
          .map((rule) => {
            const item = rule as Record<string, unknown>;
            return {
              productId: typeof item.productId === 'string' ? item.productId : '',
              productName: typeof item.productName === 'string' ? item.productName : '',
              enabled: Boolean(item.enabled),
              paused: Boolean(item.paused),
              appearancesInPeriod:
                typeof item.appearancesInPeriod === 'number'
                  ? item.appearancesInPeriod
                  : Number.parseInt(String(item.appearancesInPeriod ?? 0), 10) || 0,
              storiesInPeriod:
                typeof item.storiesInPeriod === 'number'
                  ? item.storiesInPeriod
                  : Number.parseInt(String(item.storiesInPeriod ?? 0), 10) || 0,
              fixedWeekdays: Array.isArray(item.fixedWeekdays)
                ? item.fixedWeekdays.filter((day): day is number => typeof day === 'number')
                : [],
              consecutiveRule:
                item.consecutiveRule === 'force'
                  ? 'force'
                  : item.consecutiveRule === 'allow'
                    ? 'allow'
                    : 'avoid',
              allDays: Boolean(item.allDays),
              priority:
                typeof item.priority === 'number'
                  ? item.priority
                  : Number.parseInt(String(item.priority ?? 0), 10) || 0
            };
          })
      : []
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const batches = await getWorkspacePlannerBatches(workspace);
  return NextResponse.json({ batches });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { config?: unknown } | null;
  const config = sanitizePlannerConfig(body?.config);

  if (!config) {
    return NextResponse.json({ error: 'Configuração do cronograma inválida.' }, { status: 400 });
  }

  const products = await getWorkspaceProducts(workspace);
  const preview = generateSchedulePlan(config, products);
  const user = await getAuthenticatedUser();

  const { admin, context } = access;
  const { data, error } = await admin
    .from('content_planner_batches')
    .insert({
      company_id: context.companyId,
      created_by_user_id: user?.id ?? null,
      mode: config.mode,
      status: 'queued',
      range_start: config.startDate,
      range_end: config.endDate,
      reason: config.reason.trim(),
      config,
      summary: preview.summary,
      progress_total: preview.posts.length,
      progress_completed: 0
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel iniciar o cronograma.' }, { status: 500 });
  }

  const batchId = data.id;

  after(async () => {
    await processContentPlannerBatch({
      batchId,
      companyId: context.companyId
    });
  });

  const batches = await getWorkspacePlannerBatches(workspace);
  const batch = batches.find((item) => item.id === batchId);

  return NextResponse.json({
    batch,
    preview: {
      summary: preview.summary,
      totalItems: preview.posts.length
    }
  });
}
