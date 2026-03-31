import type { PortfolioRebalanceRun } from '@/api-client';

export const EXECUTION_POLLING_MS = 2000;

export function canExecuteRunStatus(status: string | undefined): boolean {
  return status === 'draft' || status === 'failed';
}

export function isRunExecutionInProgress(status: string | undefined): boolean {
  return status === 'queued' || status === 'executing';
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
