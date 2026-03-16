/**
 * Human-readable error message utility.
 * Converts technical errors into friendly messages.
 */
export function humanError(err: any): string {
  const msg = String(err?.message || err?.error || err || '').toLowerCase();

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('session'))
    return 'Session expired. Please sign in again.';

  if (msg.includes('limit_reached') || msg.includes('plan limit') || msg.includes('plan_limit'))
    return 'Plan limit reached. Upgrade to continue.';

  if (msg.includes('team') || msg.includes('no team'))
    return 'Account issue. Please sign out and back in.';

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect'))
    return 'Connection error. Check your internet.';

  if (msg.includes('linkedin'))
    return 'LinkedIn error. Try again in a moment.';

  if (msg.includes('duplicate') || msg.includes('already exists'))
    return 'This item already exists.';

  if (msg.includes('not found') || msg.includes('404'))
    return 'Item not found. It may have been deleted.';

  if (msg.includes('forbidden') || msg.includes('403'))
    return 'You don\'t have permission for this action.';

  if (msg.includes('too many') || msg.includes('rate'))
    return 'Too many requests. Please wait a moment.';

  return 'Something went wrong. Please try again.';
}
