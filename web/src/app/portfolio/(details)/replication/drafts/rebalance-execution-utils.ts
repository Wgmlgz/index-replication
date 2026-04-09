import type { PortfolioRebalanceRun } from '@/api-client';

export const EXECUTION_POLLING_MS = 2000;

export function canExecuteRunStatus(status: string | undefined): boolean {
  return status === 'draft' || status === 'failed';
}

export function isRunPlanningInProgress(status: string | undefined): boolean {
  return status === 'planning_queued' || status === 'planning';
}

export function isRunExecutionInProgress(status: string | undefined): boolean {
  return status === 'queued' || status === 'executing';
}

export function hasExecutionState(status: string | undefined): boolean {
  return (
    status === 'queued' ||
    status === 'executing' ||
    status === 'completed' ||
    status === 'partially_completed' ||
    status === 'failed'
  );
}

export function mergeRunByID(
  runs: PortfolioRebalanceRun[],
  nextRun: PortfolioRebalanceRun,
): PortfolioRebalanceRun[] {
  const nextID = nextRun.id;
  if (typeof nextID !== 'number' || nextID <= 0) {
    return runs;
  }
  const found = runs.some(row => row.id === nextID);
  if (!found) {
    return [nextRun, ...runs];
  }
  return runs.map(row => (row.id === nextID ? nextRun : row));
}
