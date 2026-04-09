import type { PortfolioRebalanceRun } from '@/api-client';

export const STATUS_POLLING_MS = 2000;

export function canExecuteRunStatus(status: string | undefined): boolean {
  return status === 'draft' || status === 'failed';
}

export function isRunPlanningInProgress(status: string | undefined): boolean {
  return status === 'planning_queued' || status === 'planning';
}

export function isRunExecutionInProgress(status: string | undefined): boolean {
  return status === 'queued' || status === 'executing';
}

export function hasStatusState(status: string | undefined): boolean {
  return (
    status === 'planning_queued' ||
    status === 'planning' ||
    status === 'planning_failed' ||
    status === 'draft' ||
    status === 'queued' ||
    status === 'executing' ||
    status === 'completed' ||
    status === 'partially_completed' ||
    status === 'failed'
  );
}

export function runStatusBadgeLabelKey(status: string | undefined): string {
  switch (status) {
    case 'planning_queued':
    case 'planning':
      return 'portfolio.replication.rebalances.runStatusBadge.planning';
    case 'draft':
      return 'portfolio.replication.rebalances.runStatusBadge.planningDone';
    case 'planning_failed':
      return 'portfolio.replication.rebalances.runStatusBadge.planningFailed';
    case 'queued':
    case 'executing':
      return 'portfolio.replication.rebalances.runStatusBadge.executing';
    case 'completed':
      return 'portfolio.replication.rebalances.runStatusBadge.completed';
    case 'partially_completed':
      return 'portfolio.replication.rebalances.runStatusBadge.partiallyCompleted';
    case 'failed':
      return 'portfolio.replication.rebalances.runStatusBadge.failed';
    default:
      return 'portfolio.replication.rebalances.runStatusBadge.unknown';
  }
}

export function runStatusBadgeIconKey(status: string | undefined): string {
  switch (status) {
    case 'planning_queued':
    case 'planning':
      return 'planning';
    case 'draft':
      return 'planning_done';
    case 'planning_failed':
      return 'planning_failed';
    case 'queued':
    case 'executing':
      return 'executing';
    case 'completed':
      return 'completed';
    case 'partially_completed':
      return 'partially_completed';
    case 'failed':
      return 'failed';
    default:
      return 'unknown';
  }
}

export function runStatusPhaseLabelKey(status: string | undefined): string {
  switch (status) {
    case 'planning_queued':
    case 'planning':
    case 'draft':
      return 'portfolio.replication.rebalances.statusPhase.planning';
    case 'queued':
    case 'executing':
      return 'portfolio.replication.rebalances.statusPhase.executing';
    case 'completed':
    case 'partially_completed':
      return 'portfolio.replication.rebalances.statusPhase.finished';
    case 'planning_failed':
    case 'failed':
      return 'portfolio.replication.rebalances.statusPhase.failed';
    default:
      return 'portfolio.replication.rebalances.statusPhase.unknown';
  }
}

export function statusStageLabelKey(stageCode: string | undefined): string | null {
  switch (stageCode) {
    case 'planning_queued':
      return 'portfolio.replication.rebalances.statusStage.planningQueued';
    case 'planning_started':
      return 'portfolio.replication.rebalances.statusStage.planningStarted';
    case 'planning_snapshot_loading':
      return 'portfolio.replication.rebalances.statusStage.planningSnapshotLoading';
    case 'planning_algorithm_running':
      return 'portfolio.replication.rebalances.statusStage.planningAlgorithmRunning';
    case 'planning_encoding_output':
      return 'portfolio.replication.rebalances.statusStage.planningEncodingOutput';
    case 'planning_persisting':
      return 'portfolio.replication.rebalances.statusStage.planningPersisting';
    case 'planning_completed':
      return 'portfolio.replication.rebalances.statusStage.planningCompleted';
    case 'planning_failed':
      return 'portfolio.replication.rebalances.statusStage.planningFailed';
    case 'execution_running':
      return 'portfolio.replication.rebalances.statusStage.executionRunning';
    case 'execution_starting':
      return 'portfolio.replication.rebalances.statusStage.executionStarting';
    case 'execution_preparing_items':
      return 'portfolio.replication.rebalances.statusStage.executionPreparingItems';
    case 'execution_provider_unsupported':
      return 'portfolio.replication.rebalances.statusStage.executionProviderUnsupported';
    case 'execution_no_items':
      return 'portfolio.replication.rebalances.statusStage.executionNoItems';
    case 'execution_item_running':
      return 'portfolio.replication.rebalances.statusStage.executionItemRunning';
    case 'execution_finalizing':
      return 'portfolio.replication.rebalances.statusStage.executionFinalizing';
    case 'execution_completed':
      return 'portfolio.replication.rebalances.statusStage.executionCompleted';
    case 'execution_partially_completed':
      return 'portfolio.replication.rebalances.statusStage.executionPartiallyCompleted';
    case 'execution_failed':
      return 'portfolio.replication.rebalances.statusStage.executionFailed';
    default:
      return null;
  }
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
