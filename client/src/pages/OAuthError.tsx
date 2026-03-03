const REASONS: Record<string, { title: string; message: string }> = {
    denied: {
        title: 'Access Denied',
        message: 'You denied access to your LinkedIn account. If this was a mistake, click the button below to try again.',
    },
    invalid_state: {
        title: 'Session Expired',
        message: 'Your authentication session has expired or was already used. This can happen if you took too long on the LinkedIn page, or opened the link in a different browser.',
    },
    state_expired: {
        title: 'Session Expired',
        message: 'Your authentication session timed out (10 minutes). Please go back to your invite link and click Connect LinkedIn again.',
    },
    token_exchange_failed: {
        title: 'Connection Failed',
        message: 'We could not complete the connection with LinkedIn. This is usually temporary — please wait a moment and try again.',
    },
    missing_params: {
        title: 'Incomplete Response',
        message: 'LinkedIn did not return the expected data. This can happen if the page was interrupted. Please try again.',
    },
    callback_failed: {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred while completing your connection. Please try again — if it persists, contact your campaign manager.',
    },
    server_config_error: {
        title: 'Server Error',
        message: 'There is a temporary server configuration issue. Please try again later or contact support.',
    },
    state_query_error: {
        title: 'Server Error',
        message: 'Could not verify your authentication session. Please try again.',
    },
    state_claim_failed: {
        title: 'Session Conflict',
        message: 'Your session could not be claimed — another request may have used it. Please use your invite link to start a fresh connection.',
    },
    db_store_failed: {
        title: 'Save Failed',
        message: 'Your LinkedIn connection was verified but we could not save it. Please try again — your LinkedIn account is safe.',
    },
};

const DEFAULT_REASON = {
    title: 'Authentication Error',
    message: 'Something went wrong during authentication. Please try again using your invite link.',
};

export default function OAuthError() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason') || '';
    const invite = params.get('invite') || '';
    const info = REASONS[reason] || DEFAULT_REASON;

    // Build the "Try Again" URL: prefer invite link if we know the token
    const tryAgainUrl = invite ? `/invite/${invite}` : '/';
    const tryAgainLabel = invite ? '← Try Again' : '← Back to Homepage';

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            <div style={{
                maxWidth: '440px',
                width: '100%',
                backgroundColor: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                padding: '40px 32px',
                textAlign: 'center',
            }}>
                {/* Error icon */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto',
                }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>

                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 12px 0' }}>
                    {info.title}
                </h1>
                <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                    {info.message}
                </p>

                {/* Tip for in-app browsers */}
                <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '24px',
                    textAlign: 'left',
                }}>
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0, lineHeight: '1.5' }}>
                        💡 <strong>Tip:</strong> For the best experience, open your invite link in <strong>Chrome</strong> or <strong>Safari</strong> — not inside email apps or messengers.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <a
                        href={tryAgainUrl}
                        style={{
                            display: 'block',
                            padding: '14px 24px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '15px',
                            textDecoration: 'none',
                            transition: 'background-color 0.2s',
                        }}
                    >
                        {tryAgainLabel}
                    </a>
                    <a
                        href="/"
                        style={{
                            display: 'block',
                            padding: '14px 24px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '10px',
                            fontWeight: '600',
                            fontSize: '15px',
                            textDecoration: 'none',
                        }}
                    >
                        Go to Homepage
                    </a>
                </div>

                {reason && (
                    <p style={{ fontSize: '11px', color: '#d1d5db', marginTop: '20px' }}>
                        Error: {reason}
                    </p>
                )}
            </div>
        </div>
    );
}
