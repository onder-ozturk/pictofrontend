const ROADMAP_DEFAULT_TOTAL_TASKS = 55;
const ROADMAP_DEFAULT_TOTAL_SP = 338;

export const ROADMAP_STORAGE_KEY = "roadmap-checked-v2";
export const ROADMAP_UPDATE_COUNT_KEY = "roadmap-update-count-v2";
export const ROADMAP_UPDATE_AT_KEY = "roadmap-update-at-v2";
export const ROADMAP_METRICS_KEY = "roadmap-metrics-v2";

export interface RoadmapMetrics {
  taskCount: number;
  totalSp: number;
  taskSpById: Record<string, number>;
  sprintCount: number;
  updatedAt: string;
}

export interface RoadmapLiveProgress {
  taskCount: number;
  completedTasks: number;
  completedSP: number;
  totalSP: number;
  completionPct: number;
  spCompletionPct: number;
  remainingTasks: number;
  remainingSP: number;
  updateCount: number;
  lastUpdateAt: string;
  metricsUpdatedAt: string;
  hasData: boolean;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function readTaskMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, number> = {};
  for (const [id, item] of Object.entries(value as Record<string, unknown>)) {
    const num = Number(item);
    if (Number.isFinite(num)) out[id] = num;
  }
  return out;
}

function readCheckedTasks(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, boolean> = {};
  for (const [id, valueItem] of Object.entries(value as Record<string, unknown>)) {
    if (typeof valueItem === "boolean") out[id] = valueItem;
  }
  return out;
}

const FALLBACK_METRICS: RoadmapMetrics = {
  taskCount: ROADMAP_DEFAULT_TOTAL_TASKS,
  totalSp: ROADMAP_DEFAULT_TOTAL_SP,
  taskSpById: {},
  sprintCount: 4,
  updatedAt: new Date(0).toISOString(),
};

export function getRoadmapProgress(): RoadmapLiveProgress {
  if (typeof window === "undefined") {
    return {
      taskCount: FALLBACK_METRICS.taskCount,
      completedTasks: 0,
      completedSP: 0,
      totalSP: FALLBACK_METRICS.totalSp,
      completionPct: 0,
      spCompletionPct: 0,
      remainingTasks: FALLBACK_METRICS.taskCount,
      remainingSP: FALLBACK_METRICS.totalSp,
      updateCount: 0,
      lastUpdateAt: "",
      metricsUpdatedAt: FALLBACK_METRICS.updatedAt,
      hasData: false,
    };
  }

  const metrics = readJson<RoadmapMetrics>(ROADMAP_METRICS_KEY) || FALLBACK_METRICS;
  const checked = readCheckedTasks(readJson<Record<string, boolean>>(ROADMAP_STORAGE_KEY));
  const checkedEntries = Object.entries(checked);
  const activeChecks = checkedEntries.filter(([, isDone]) => isDone);
  const taskCount = toNumber(metrics.taskCount, FALLBACK_METRICS.taskCount);
  const totalSP = toNumber(metrics.totalSp, FALLBACK_METRICS.totalSp);
  const taskSpById = readTaskMap(metrics.taskSpById);

  const completedTasks = activeChecks.length;
  const completedSP = activeChecks.reduce((sum, [id]) => sum + (taskSpById[id] ?? 0), 0);
  const completionPct = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
  const spCompletionPct = totalSP > 0 ? Math.round((completedSP / totalSP) * 100) : 0;
  const remainingTasks = Math.max(taskCount - completedTasks, 0);
  const remainingSP = Math.max(totalSP - completedSP, 0);
  const rawUpdateCount = readJson<number>(ROADMAP_UPDATE_COUNT_KEY);
  const updateCount = toNumber(rawUpdateCount, 0);
  const lastUpdateAt = readJson<string>(ROADMAP_UPDATE_AT_KEY) ?? "";
  const hasData = taskCount > 0 || completedTasks > 0 || Object.keys(checked).length > 0 || updateCount > 0;
  const metricsUpdatedAt = metrics.updatedAt || new Date(0).toISOString();

  return {
    taskCount,
    completedTasks,
    completedSP,
    totalSP,
    completionPct,
    spCompletionPct,
    remainingTasks,
    remainingSP,
    updateCount,
    lastUpdateAt,
    metricsUpdatedAt,
    hasData,
  };
}
