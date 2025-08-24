import { Component, ErrorInfo, ReactNode } from 'react';

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
      errorId 
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
        <div className="min-h-screen bg-gradient-to-br from-sandy-beige to-white flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-8 max-w-lg w-full">
            {/* Travel Journal styled header */}
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🧭</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! We've hit a detour
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Your travel journal encountered an unexpected issue. Don't worry - your data is safe and we can get you back on track.
              </p>
            </div>

            {/* Error details for users */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">What happened?</h3>
              <p className="text-sm text-gray-600">
                {this.state.error?.message || 'An unexpected error occurred while loading your travel journal.'}
              </p>
              {this.state.errorId && (
                <p className="text-xs text-gray-500 mt-2">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-alpine-teal text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium flex items-center justify-center gap-2"
              >
                <span>🔄</span>
                Try Again
              </button>
              <button
                onClick={this.handleRefresh}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium flex items-center justify-center gap-2"
              >
                <span>↻</span>
                Refresh Page
              </button>
            </div>

            {/* Developer error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 border-t border-gray-200 pt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                  🛠️ Developer Details
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Error Message</h4>
                    <pre className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stack Trace</h4>
                    <pre className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  </div>

                  {this.state.errorInfo && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Component Stack</h4>
                      <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Help text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 leading-relaxed">
                If this error persists, your browser's local storage might be corrupted. 
                Try clearing your browser data for this site as a last resort.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
