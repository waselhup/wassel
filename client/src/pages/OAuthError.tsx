import { useLocation } from 'wouter';

const REASONS: Record<string, { title: string; message: string }> = {
    denied: {
        title: 'Access Denied',
        message: 'You denied access to your LinkedIn account. If this was a mistake, please try again.',
    },
    invalid_state: {
        title: 'Session Expired',
        message: 'Your authentication session has expired or is invalid. Please use your invite link again.',
    },
    state_already_used: {
        title: 'Link Already Used',
        message: 'This authentication session has already been used. If you need to reconnect, use your invite link again.',
    },
    state_expired: {
        title: 'Session Expired',
        message: 'Your authentication session expired. Please go back to your invite link and try again.',
    },
    token_exchange_failed: {
        title: 'Connection Failed',
        message: 'We could not complete the connection with LinkedIn. Please try again in a few minutes.',
    },
    missing_params: {
        title: 'Invalid Request',
        message: 'The authentication response was incomplete. Please try again from your invite link.',
    },
    callback_failed: {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred during authentication. Please try again.',
    },
    server_config_error: {
        title: 'Server Error',
        message: 'There is a temporary server issue. Please try again later or contact support.',
    },
    state_query_error: {
        title: 'Server Error',
        message: 'Could not verify your authentication session. Please try again.',
    },
    state_claim_failed: {
        title: 'Session Conflict',
        message: 'Your session could not be claimed. Please use your invite link again.',
    },
};

const DEFAULT_REASON = {
    title: 'Authentication Error',
    message: 'Something went wrong during authentication. Please try again using your invite link.',
};

export default function OAuthError() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason') || '';
    const info = REASONS[reason] || DEFAULT_REASON;

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-3">{info.title}</h1>
                <p className="text-gray-600 mb-8 leading-relaxed">{info.message}</p>
                <div className="space-y-3">
                    <button
                        onClick={() => window.history.back()}
                        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        ← Try Again
                    </button>
                    <a
                        href="/"
                        className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Go to Homepage
                    </a>
                </div>
                {reason && (
                    <p className="text-xs text-gray-400 mt-6">Error code: {reason}</p>
                )}
            </div>
        </div>
    );
}
