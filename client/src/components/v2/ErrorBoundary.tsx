import { Component, type ErrorInfo, type ReactNode } from 'react';
import EmptyState from '@/components/v2/EmptyState';
import Button from '@/components/v2/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** optional custom fallback. Receives reset to clear the error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * v2 ErrorBoundary — catches render-time errors anywhere in the v2 subtree
 * and shows a friendly Arabic message with a retry button. Logs to console
 * (dev) so the underlying error isn't lost.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to dev tools without spamming production toasts.
    if (typeof console !== 'undefined') {
      console.error('[v2:ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-v2-canvas px-4">
        <EmptyState
          variant="error"
          title="حدث خطأ غير متوقع"
          description="نعتذر عن ذلك. أعد المحاولة، وإذا استمرت المشكلة تواصل مع الدعم."
          action={
            <div className="flex gap-2">
              <Button variant="primary" size="md" onClick={this.reset}>
                إعادة المحاولة
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  window.history.pushState(null, '', '/v2');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  this.reset();
                }}
              >
                العودة للرئيسية
              </Button>
            </div>
          }
        />
      </div>
    );
  }
}

export default ErrorBoundary;
