const ACTION_LABELS: Record<string, string> = {
  user_created: 'User created',
  user_deleted: 'User deleted',
  user_updated: 'User updated',
  user_blocked: 'User blocked',
  user_unblocked: 'User unblocked',
  user_login: 'User login',
  user_logout: 'User logout',
  login_verification_requested: 'Login verification requested',
  login_verification_approved: 'Login verification approved',
  login_verification_denied: 'Login verification denied',
  telegram_connected: 'Telegram connected',
  telegram_disconnected: 'Telegram disconnected',
  telegram_2fa_updated: 'Telegram 2FA updated',
  tbank_connected: 'T-Bank connected',
  tbank_disconnected: 'T-Bank disconnected',
  tbank_default_account_updated: 'T-Bank default account updated',
  tbank_sandbox_pay_in: 'T-Bank sandbox pay-in',
  tbank_sandbox_pay_out: 'T-Bank sandbox pay-out',
  tbank_buy_order_created: 'T-Bank buy order created',
  tbank_sell_order_created: 'T-Bank sell order created',
  portfolio_profile_created: 'Portfolio profile created',
  portfolio_profile_updated: 'Portfolio profile updated',
  portfolio_profile_deleted: 'Portfolio profile deleted',
  portfolio_action_executed: 'Portfolio action executed',
  portfolio_rebalance_created: 'Rebalance draft created',
  portfolio_rebalance_planning_failed: 'Rebalance planning failed',
  portfolio_rebalance_deleted: 'Rebalance draft deleted',
  portfolio_rebalance_queued: 'Rebalance queued',
  portfolio_rebalance_finished: 'Rebalance finished',
  rebalance_confirmation_sent: 'Rebalance confirmation sent',
  rebalance_confirmation_approved: 'Rebalance confirmation approved',
  rebalance_confirmation_denied: 'Rebalance confirmation denied',

  // Legacy actions that can still exist in historical data.
  recognition_request_success: 'Recognition request succeeded',
  recognition_request_fail: 'Recognition request failed',
  recognition_user_detect_request_success: 'User recognition request succeeded',
  recognition_user_detect_request_fail: 'User recognition request failed',
  recognition_user_recognize_sku_request_success: 'SKU recognition request succeeded',
  recognition_user_recognize_sku_request_fail: 'SKU recognition request failed',
};

const ACTION_COLORS: Record<string, string> = {
  user_created: 'bg-emerald-100 text-emerald-800',
  user_deleted: 'bg-red-100 text-red-800',
  user_updated: 'bg-blue-100 text-blue-800',
  user_blocked: 'bg-red-100 text-red-800',
  user_unblocked: 'bg-amber-100 text-amber-800',
  user_login: 'bg-emerald-100 text-emerald-800',
  user_logout: 'bg-slate-100 text-slate-800',
  login_verification_requested: 'bg-blue-100 text-blue-800',
  login_verification_approved: 'bg-emerald-100 text-emerald-800',
  login_verification_denied: 'bg-red-100 text-red-800',
  telegram_connected: 'bg-emerald-100 text-emerald-800',
  telegram_disconnected: 'bg-red-100 text-red-800',
  telegram_2fa_updated: 'bg-blue-100 text-blue-800',
  tbank_connected: 'bg-emerald-100 text-emerald-800',
  tbank_disconnected: 'bg-red-100 text-red-800',
  tbank_default_account_updated: 'bg-blue-100 text-blue-800',
  tbank_sandbox_pay_in: 'bg-blue-100 text-blue-800',
  tbank_sandbox_pay_out: 'bg-blue-100 text-blue-800',
  tbank_buy_order_created: 'bg-emerald-100 text-emerald-800',
  tbank_sell_order_created: 'bg-emerald-100 text-emerald-800',
  portfolio_profile_created: 'bg-emerald-100 text-emerald-800',
  portfolio_profile_updated: 'bg-blue-100 text-blue-800',
  portfolio_profile_deleted: 'bg-red-100 text-red-800',
  portfolio_action_executed: 'bg-blue-100 text-blue-800',
  portfolio_rebalance_created: 'bg-emerald-100 text-emerald-800',
  portfolio_rebalance_planning_failed: 'bg-red-100 text-red-800',
  portfolio_rebalance_deleted: 'bg-red-100 text-red-800',
  portfolio_rebalance_queued: 'bg-amber-100 text-amber-800',
  portfolio_rebalance_finished: 'bg-emerald-100 text-emerald-800',
  rebalance_confirmation_sent: 'bg-blue-100 text-blue-800',
  rebalance_confirmation_approved: 'bg-emerald-100 text-emerald-800',
  rebalance_confirmation_denied: 'bg-red-100 text-red-800',
  recognition_request_success: 'bg-emerald-100 text-emerald-800',
  recognition_request_fail: 'bg-red-100 text-red-800',
  recognition_user_detect_request_success: 'bg-emerald-100 text-emerald-800',
  recognition_user_detect_request_fail: 'bg-red-100 text-red-800',
  recognition_user_recognize_sku_request_success: 'bg-emerald-100 text-emerald-800',
  recognition_user_recognize_sku_request_fail: 'bg-red-100 text-red-800',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  user: 'User',
  system: 'System',
  recognition: 'Recognition',
  portfolio: 'Portfolio',
  tbank: 'T-Bank',
  telegram: 'Telegram',
  rebalance: 'Rebalance',
  auth: 'Authentication',
};

export const actionLabels = ACTION_LABELS;
export const actionColors = ACTION_COLORS;
export const entityTypeLabels = ENTITY_TYPE_LABELS;

export function formatAuditToken(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? formatAuditToken(action);
}

export function getEntityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? formatAuditToken(entityType);
}
