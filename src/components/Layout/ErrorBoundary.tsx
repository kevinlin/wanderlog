import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging for better debugging
    console.group('🚨 ErrorBoundary caught an error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error ID:', this.state.errorId);
    console.groupEnd();

    // Store error info for debugging
    this.setState({ errorInfo });

    // In production, you could send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // sendErrorReport({ error, errorInfo, errorId: this.state.errorId });
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sandy-beige to-white p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-100 bg-white p-8 shadow-xl">
            {/* Travel Journal styled header */}
            <div className="mb-6 text-center">
              <div className="mb-4 text-6xl">🧭</div>
              <h2 className="mb-2 font-bold text-2xl text-gray-900">Oops! We've hit a detour</h2>
              <p className="text-gray-600 leading-relaxed">
                Your travel journal encountered an unexpected issue. Don't worry - your data is safe and we can get you back on track.
              </p>
            </div>

            {/* Error details for users */}
            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <h3 className="mb-2 font-semibold text-gray-700 text-sm">What happened?</h3>
              <p className="text-gray-600 text-sm">
                {this.state.error?.message || 'An unexpected error occurred while loading your travel journal.'}
              </p>
              {this.state.errorId && <p className="mt-2 text-gray-500 text-xs">Error ID: {this.state.errorId}</p>}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-alpine-teal px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
                onClick={this.handleRetry}
              >
                <span>🔄</span>
                Try Again
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-200"
                onClick={this.handleRefresh}
              >
                <span>↻</span>
                Refresh Page
              </button>
            </div>

            {/* Developer error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 border-gray-200 border-t pt-4">
                <summary className="cursor-pointer font-medium text-gray-700 text-sm transition-colors hover:text-gray-900">
                  🛠️ Developer Details
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Error Message</h4>
                    <pre className="mt-1 overflow-auto rounded bg-red-50 p-2 text-red-600 text-xs">{this.state.error.message}</pre>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Stack Trace</h4>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-red-50 p-2 text-red-600 text-xs">{this.state.error.stack}</pre>
                  </div>

                  {this.state.errorInfo && (
                    <div>
                      <h4 className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Component Stack</h4>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-gray-600 text-xs">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Help text */}
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-xs leading-relaxed">
                If this error persists, your browser's local storage might be corrupted. Try clearing your browser data for this site as a
                last resort.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
