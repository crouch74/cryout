import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🧱 [App] Unhandled render error.', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="loading-shell">
          <div className="loading-card">
            <span className="eyebrow">Application Error</span>
            <h1>The table could not be rendered.</h1>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
