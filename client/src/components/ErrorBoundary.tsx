import React from 'react';
import { AlertCircle, RefreshCw, MessageSquare, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * ErrorBoundary — prevents white screens. Wraps the app and any heavy
 * subtree. Logs to console, pings Telegram via api/log-error if available.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught error:', error, errorInfo);
    this.setState({ errorInfo });

    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      }).catch(() => {});
    } catch {}
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  handleFeedback = () => {
    const subject = encodeURIComponent('Wassel error report');
    const body = encodeURIComponent(
      `Error: ${this.state.error?.message || 'Unknown error'}\n\n` +
        `URL: ${typeof window !== 'undefined' ? window.location.href : ''}\n` +
        `Time: ${new Date().toISOString()}`,
    );
    window.location.href = `mailto:waselhup@gmail.com?subject=${subject}&body=${body}`;
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isAr =
      typeof document !== 'undefined' &&
      document.documentElement.dir === 'rtl';

    const title = this.props.fallbackTitle || (isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong');
    const message =
      this.props.fallbackMessage ||
      (isAr
        ? 'عذراً، واجهنا مشكلة. حاول إعادة تحميل الصفحة أو العودة للرئيسية.'
        : "Sorry, we hit a snag. Try reloading or returning home.");

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)',
          padding: 24,
          fontFamily: 'Cairo, Inter, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: '#fff',
            borderRadius: 20,
            padding: '40px 32px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
            textAlign: 'center',
            border: '1px solid #FECACA',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              margin: '0 auto 20px',
              background: 'rgba(220,38,38,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={36} color="#DC2626" />
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#1F2937',
              margin: '0 0 10px',
              letterSpacing: '-0.5px',
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#6B7280',
              lineHeight: 1.7,
              margin: '0 0 24px',
            }}
          >
            {message}
          </p>

          {this.state.error?.message && (
            <details
              style={{
                background: '#F9FAFB',
                borderRadius: 10,
                padding: 12,
                marginBottom: 20,
                textAlign: 'start',
                fontSize: 11,
                color: '#6B7280',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                {isAr ? 'تفاصيل تقنية' : 'Technical details'}
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(10,143,132,0.25)',
              }}
            >
              <RefreshCw size={15} /> {isAr ? 'إعادة تحميل' : 'Reload'}
            </button>
            <button
              onClick={this.handleHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 20px',
                borderRadius: 12,
                background: '#fff',
                color: '#14b8a6',
                border: '1.5px solid #14b8a6',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <Home size={15} /> {isAr ? 'الرئيسية' : 'Home'}
            </button>
            <button
              onClick={this.handleFeedback}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 20px',
                borderRadius: 12,
                background: '#F3F4F6',
                color: '#374151',
                border: 'none',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <MessageSquare size={15} /> {isAr ? 'أخبرنا' : 'Tell us'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
