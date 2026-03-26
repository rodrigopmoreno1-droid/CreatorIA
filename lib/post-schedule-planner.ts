import type { ProductItem } from '@/types/platform';

export type PlannerMode = 'create' | 'replan';
export type SchedulePeriodPreset = '1' | '7' | '15' | '30' | 'custom';
export type ConsecutiveRule = 'allow' | 'avoid' | 'force';
export type PlannerChannel = 'Feed' | 'Reels' | 'Stories';
export type PlannerStatus = 'production';
export type PlannerContentType = 'reels' | 'stories' | 'video_curto' | 'carrossel' | 'post';

export type PlannerProductRule = {
  productId: string;
  productName: string;
  enabled: boolean;
  paused: boolean;
  appearancesInPeriod: number;
  storiesInPeriod: number;
  fixedWeekdays: number[];
  consecutiveRule: ConsecutiveRule;
  allDays: boolean;
  priority: number;
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  periodPreset: SchedulePeriodPreset;
  daySpan: number;
  feedPerDay: number;
  productRules: PlannerProductRule[];
  createdAt: string;
  updatedAt: string;
};

export type PlannerConfig = {
  mode: PlannerMode;
  periodPreset: SchedulePeriodPreset;
  startDate: string;
  endDate: string;
  feedPerDay: number;
  reason: string;
  templateId?: string;
  productRules: PlannerProductRule[];
};

export type PlannerMeta = {
  source: 'planner';
  batchId: string;
  rangeStart: string;
  rangeEnd: string;
  mode: PlannerMode;
  reason: string;
  templateId?: string;
  productRuleId?: string;
  fixedWeekdays?: number[];
  fixedPlacement?: boolean;
  storiesInPeriod?: number;
  slotType?: 'feed' | 'stories';
  slotIndex?: number;
  sequenceSize?: number;
};

export type GeneratedPlannerPost = {
  id: string;
  title: string;
  channel: PlannerChannel;
  status: PlannerStatus;
  scheduledFor: string;
  contentType: PlannerContentType;
  subOption: string;
  caption: string;
  imageUrl: string;
  notes: string;
  productId?: string;
  productName?: string;
  createdAt: string;
  plannerMeta: PlannerMeta;
};

export type PlannerProductSummary = {
  productId: string;
  productName: string;
  scheduledDates: string[];
  fixedDates: string[];
  storiesTotal: number;
};

export type ScheduleGenerationSummary = {
  totalDays: number;
  totalFeedPosts: number;
  totalStoryPosts: number;
  totalPosts: number;
  products: PlannerProductSummary[];
};

export type ScheduleGenerationResult = {
  range: { startDate: string; endDate: string };
  mode: PlannerMode;
  reason: string;
  templateId?: string;
  posts: GeneratedPlannerPost[];
  summary: ScheduleGenerationSummary;
};

type Assignment = {
  productId: string;
  productName: string;
  fixedPlacement: boolean;
  fixedWeekdays: number[];
  priority: number;
};

function atNoon(date: string) {
  return new Date(`${date}T12:00:00`);
}

export function getDatesInRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return [] as string[];
  }

  const start = atNoon(startDate);
  const end = atNoon(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [] as string[];
  }

  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function daySpanFromRange(startDate: string, endDate: string) {
  const dates = getDatesInRange(startDate, endDate);
  return dates.length;
}

export function computeEndDateFromPreset(startDate: string, preset: SchedulePeriodPreset, fallbackEndDate?: string) {
  if (preset === 'custom') {
    return fallbackEndDate ?? startDate;
  }

  const totalDays = Number.parseInt(preset, 10);
  const date = atNoon(startDate);
  date.setDate(date.getDate() + Math.max(0, totalDays - 1));
  return date.toISOString().slice(0, 10);
}

export function isPlannerGeneratedPost(post: { id?: string; plannerMeta?: { source?: string } | null }) {
  return post.plannerMeta?.source === 'planner' || Boolean(post.id?.startsWith('sched_'));
}

export function buildDefaultProductRules(products: ProductItem[]) {
  return products.map<PlannerProductRule>((product, index) => ({
    productId: product.id,
    productName: product.name,
    enabled: true,
    paused: false,
    appearancesInPeriod: 1,
    storiesInPeriod: 3,
    fixedWeekdays: [],
    consecutiveRule: 'avoid',
    allDays: false,
    priority: products.length - index
  }));
}

export function mergeTemplateProductRules(templateRules: PlannerProductRule[], products: ProductItem[]) {
  const currentProducts = new Map(products.map((product) => [product.id, product]));
  const templateById = new Map(templateRules.map((rule) => [rule.productId, rule]));

  const merged = products.map((product, index) => {
    const templateRule = templateById.get(product.id);

    return (
      templateRule
        ? {
            ...templateRule,
            storiesInPeriod:
              typeof templateRule.storiesInPeriod === 'number'
                ? templateRule.storiesInPeriod
                : 3
          }
        : {
        productId: product.id,
        productName: product.name,
        enabled: false,
        paused: false,
        appearancesInPeriod: 1,
        storiesInPeriod: 3,
        fixedWeekdays: [],
        consecutiveRule: 'avoid' as const,
        allDays: false,
        priority: products.length - index
      }
    );
  });

  return merged
    .filter((rule) => currentProducts.has(rule.productId))
    .map((rule, index) => ({
      ...rule,
      productName: currentProducts.get(rule.productId)?.name ?? rule.productName,
      priority: rule.priority || merged.length - index
    }));
}

function makeGeneratedId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const FEED_FORMAT_SEQUENCE: Array<{
  channel: Exclude<PlannerChannel, 'Stories'>;
  contentType: Exclude<PlannerContentType, 'stories'>;
  subOption: string;
}> = [
  { channel: 'Reels', contentType: 'reels', subOption: '30s' },
  { channel: 'Feed', contentType: 'carrossel', subOption: '5' },
  { channel: 'Feed', contentType: 'post', subOption: '' },
  { channel: 'Reels', contentType: 'video_curto', subOption: '60s' }
];

function getWeekday(isoDate: string) {
  return atNoon(isoDate).getDay();
}

function sortRules(rules: PlannerProductRule[]) {
  return [...rules].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (right.appearancesInPeriod !== left.appearancesInPeriod) {
      return right.appearancesInPeriod - left.appearancesInPeriod;
    }

    return left.productName.localeCompare(right.productName, 'pt-BR');
  });
}

function pickAutoDates(
  rule: PlannerProductRule,
  dates: string[],
  assignmentsByDate: Record<string, Assignment[]>,
  assignedDates: Set<string>,
  remaining: number
) {
  const picked: string[] = [];

  while (picked.length < remaining) {
    const existingIndexes = [...assignedDates, ...picked]
      .map((date) => dates.indexOf(date))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right);

    const candidates = dates
      .filter((date) => !assignedDates.has(date) && !picked.includes(date))
      .map((date) => {
        const index = dates.indexOf(date);
        const minDistance = existingIndexes.length
          ? Math.min(...existingIndexes.map((existingIndex) => Math.abs(existingIndex - index)))
          : dates.length;
        const hasAdjacent = existingIndexes.some((existingIndex) => Math.abs(existingIndex - index) === 1);
        const dayLoad = assignmentsByDate[date]?.length ?? 0;

        let score = dayLoad * 4;

        if (rule.consecutiveRule === 'avoid') {
          score += hasAdjacent ? 40 : 0;
          score += minDistance > 0 ? 8 / minDistance : 10;
        } else if (rule.consecutiveRule === 'force') {
          score += existingIndexes.length === 0 ? 0 : minDistance === 1 ? -8 : minDistance * 2;
        } else {
          score += hasAdjacent ? 3 : 0;
          score += minDistance > 0 ? 3 / minDistance : 0;
        }

        return { date, score };
      })
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }

        return left.date.localeCompare(right.date);
      });

    if (!candidates.length) {
      break;
    }

    picked.push(candidates[0].date);
  }

  return picked;
}

function buildAssignmentMap(config: PlannerConfig, products: ProductItem[]) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const dates = getDatesInRange(config.startDate, config.endDate);
  const assignmentsByDate = Object.fromEntries(dates.map((date) => [date, [] as Assignment[]])) as Record<string, Assignment[]>;
  const summaries = new Map<string, PlannerProductSummary>();
  const activeRules = sortRules(
    config.productRules.filter((rule) => rule.enabled && !rule.paused && productMap.has(rule.productId))
  );

  function ensureSummary(rule: PlannerProductRule) {
    if (!summaries.has(rule.productId)) {
      summaries.set(rule.productId, {
        productId: rule.productId,
        productName: rule.productName,
        scheduledDates: [],
        fixedDates: [],
        storiesTotal: 0
      });
    }

    return summaries.get(rule.productId)!;
  }

  function assignDate(rule: PlannerProductRule, date: string, fixedPlacement: boolean) {
    const existing = assignmentsByDate[date] ?? [];

    if (existing.some((assignment) => assignment.productId === rule.productId)) {
      return;
    }

    existing.push({
      productId: rule.productId,
      productName: rule.productName,
      fixedPlacement,
      fixedWeekdays: [...rule.fixedWeekdays],
      priority: rule.priority
    });

    assignmentsByDate[date] = existing.sort((left, right) => {
      if (left.fixedPlacement !== right.fixedPlacement) {
        return left.fixedPlacement ? -1 : 1;
      }

      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      return left.productName.localeCompare(right.productName, 'pt-BR');
    });

    const summary = ensureSummary(rule);
    summary.scheduledDates.push(date);
    if (fixedPlacement) {
      summary.fixedDates.push(date);
    }
  }

  activeRules.forEach((rule) => {
    const fixedDates = rule.allDays
      ? dates
      : dates.filter((date) => rule.fixedWeekdays.includes(getWeekday(date)));

    fixedDates.forEach((date) => assignDate(rule, date, true));
  });

  activeRules.forEach((rule) => {
    if (rule.allDays) {
      return;
    }

    const summary = ensureSummary(rule);
    const fixedCount = summary.scheduledDates.length;
    const targetAppearances = Math.max(0, Math.max(rule.appearancesInPeriod, fixedCount));
    const remaining = targetAppearances - fixedCount;

    if (remaining <= 0) {
      return;
    }

    const autoDates = pickAutoDates(
      rule,
      dates,
      assignmentsByDate,
      new Set(summary.scheduledDates),
      remaining
    );

    autoDates.forEach((date) => assignDate(rule, date, false));
  });

  activeRules.forEach((rule) => {
    const summary = ensureSummary(rule);
    summary.storiesTotal = Math.max(0, rule.storiesInPeriod);
  });

  return {
    dates,
    assignmentsByDate,
    summaries: [...summaries.values()].map((summary) => ({
      ...summary,
      scheduledDates: [...summary.scheduledDates].sort(),
      fixedDates: [...summary.fixedDates].sort()
    }))
  };
}

function buildPlannerNotes(reason: string, productName?: string) {
  const parts = ['Gerado automaticamente pelo Planejar Cronograma.'];

  if (productName) {
    parts.push(`Produto foco: ${productName}.`);
  }

  if (reason.trim()) {
    parts.push(`Contexto: ${reason.trim()}.`);
  }

  return parts.join(' ');
}

function distributeCountAcrossDates(total: number, dates: string[]) {
  if (total <= 0 || dates.length === 0) {
    return [] as Array<{ date: string; count: number }>;
  }

  const sortedDates = [...dates].sort();
  const base = Math.floor(total / sortedDates.length);
  const remainder = total % sortedDates.length;

  return sortedDates
    .map((date, index) => ({
      date,
      count: base + (index < remainder ? 1 : 0)
    }))
    .filter((item) => item.count > 0);
}

export function generateSchedulePlan(config: PlannerConfig, products: ProductItem[]): ScheduleGenerationResult {
  const { dates, assignmentsByDate, summaries } = buildAssignmentMap(config, products);
  const now = new Date().toISOString();
  const batchId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const posts: GeneratedPlannerPost[] = [];
  const activeRuleById = new Map(
    config.productRules
      .filter((rule) => rule.enabled && !rule.paused)
      .map((rule) => [rule.productId, rule])
  );
  const summaryByProductId = new Map(
    summaries.map((summary) => [
      summary.productId,
      {
        ...summary,
        scheduledDates: [...summary.scheduledDates],
        fixedDates: [...summary.fixedDates]
      }
    ])
  );

  dates.forEach((date) => {
    const assignments = assignmentsByDate[date] ?? [];

    for (let index = 0; index < Math.max(0, config.feedPerDay); index += 1) {
      const assignment = assignments.length ? assignments[index % assignments.length] : undefined;
      if (!assignment) {
        continue;
      }
      const feedFormat = FEED_FORMAT_SEQUENCE[index % FEED_FORMAT_SEQUENCE.length];
      const channel: PlannerChannel = feedFormat.channel;
      const title = `${feedFormat.contentType === 'carrossel'
        ? 'Carrossel'
        : feedFormat.contentType === 'post'
          ? 'Post estático'
          : feedFormat.contentType === 'video_curto'
            ? 'Vídeo curto'
            : channel} — ${assignment.productName}`;

      posts.push({
        id: makeGeneratedId('sched'),
        title,
        channel,
        status: 'production',
        scheduledFor: date,
        contentType: feedFormat.contentType,
        subOption: feedFormat.subOption,
        caption: '',
        imageUrl: '',
        notes: buildPlannerNotes(config.reason, assignment?.productName),
        productId: assignment?.productId,
        productName: assignment?.productName,
        createdAt: now,
        plannerMeta: {
          source: 'planner',
          batchId,
          rangeStart: config.startDate,
          rangeEnd: config.endDate,
          mode: config.mode,
          reason: config.reason.trim(),
          templateId: config.templateId,
          productRuleId: assignment?.productId,
          fixedWeekdays: assignment?.fixedWeekdays,
          fixedPlacement: assignment?.fixedPlacement ?? false,
          storiesInPeriod: assignment ? activeRuleById.get(assignment.productId)?.storiesInPeriod ?? 0 : 0,
          slotType: 'feed',
          slotIndex: index
        }
      });
    }
  });

  activeRuleById.forEach((rule) => {
    const productSummary = summaryByProductId.get(rule.productId) ?? {
      productId: rule.productId,
      productName: rule.productName,
      scheduledDates: [] as string[],
      fixedDates: [] as string[],
      storiesTotal: Math.max(0, rule.storiesInPeriod)
    };
    const storySupportDates = productSummary.scheduledDates.length
      ? [...productSummary.scheduledDates]
      : rule.allDays
      ? [...dates]
      : rule.fixedWeekdays.length
      ? dates.filter((date) => rule.fixedWeekdays.includes(getWeekday(date)))
      : pickAutoDates(
          rule,
          dates,
          assignmentsByDate,
          new Set<string>(),
          Math.min(Math.max(1, rule.storiesInPeriod), dates.length)
        );

    if (!summaryByProductId.has(rule.productId)) {
      summaryByProductId.set(rule.productId, productSummary);
    }

    storySupportDates.forEach((date) => {
      if (!productSummary.scheduledDates.includes(date)) {
        productSummary.scheduledDates.push(date);
      }

      if ((rule.allDays || rule.fixedWeekdays.includes(getWeekday(date))) && !productSummary.fixedDates.includes(date)) {
        productSummary.fixedDates.push(date);
      }
    });

    const storyDates = distributeCountAcrossDates(Math.max(0, rule.storiesInPeriod), storySupportDates);

    storyDates.forEach(({ date, count }) => {
      const assignment = (assignmentsByDate[date] ?? []).find((item) => item.productId === rule.productId);
      const fixedPlacement =
        assignment?.fixedPlacement ?? (rule.allDays || rule.fixedWeekdays.includes(getWeekday(date)));

      posts.push({
        id: makeGeneratedId('sched_story'),
        title: count > 1
          ? `Sequência de ${count} Stories — ${rule.productName}`
          : `Story único — ${rule.productName}`,
        channel: 'Stories',
        status: 'production',
        scheduledFor: date,
        contentType: 'stories',
        subOption: String(count),
        caption: '',
        imageUrl: '',
        notes: buildPlannerNotes(config.reason, rule.productName),
        productId: rule.productId,
        productName: rule.productName,
        createdAt: now,
        plannerMeta: {
          source: 'planner',
          batchId,
          rangeStart: config.startDate,
          rangeEnd: config.endDate,
          mode: config.mode,
          reason: config.reason.trim(),
          templateId: config.templateId,
          productRuleId: rule.productId,
          fixedWeekdays: rule.fixedWeekdays,
          fixedPlacement,
          storiesInPeriod: rule.storiesInPeriod,
          slotType: 'stories',
          sequenceSize: count
        }
      });
    });

    productSummary.scheduledDates.sort();
    productSummary.fixedDates.sort();
    productSummary.storiesTotal = Math.max(0, rule.storiesInPeriod);
  });

  const totalStoryPosts = posts.filter((post) => post.channel === 'Stories').length;
  const totalFeedPosts = posts.length - totalStoryPosts;

  return {
    range: {
      startDate: config.startDate,
      endDate: config.endDate
    },
    mode: config.mode,
    reason: config.reason.trim(),
    templateId: config.templateId,
    posts,
    summary: {
      totalDays: dates.length,
      totalFeedPosts,
      totalStoryPosts,
      totalPosts: posts.length,
      products: [...summaryByProductId.values()].sort((left, right) =>
        left.productName.localeCompare(right.productName, 'pt-BR')
      )
    }
  };
}
