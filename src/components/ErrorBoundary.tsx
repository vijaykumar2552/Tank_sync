import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-error-50 dark:bg-error-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-error-500" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-6">
            {this.state.error?.message || 'An unexpected error occurred. Try refreshing the page.'}
          </p>
          <button onClick={this.handleReset} className="btn-primary">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
