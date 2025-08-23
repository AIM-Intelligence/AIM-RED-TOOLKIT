import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error("[ErrorBoundary] Caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Error details:", {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-500">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-4">
              The application encountered an error. Please refresh the page to
              try again.
            </p>
            {this.state.error && (
              <details className="text-left bg-gray-900 p-4 rounded mt-4">
                <summary className="cursor-pointer text-gray-300">
                  Error details
                </summary>
                <pre className="text-xs text-gray-500 mt-2 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
