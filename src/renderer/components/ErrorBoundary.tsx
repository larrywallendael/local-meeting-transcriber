import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Renderer crashed:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-lg border border-border/70 bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold mb-2">Oops, the screen took a nap.</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Click reload to wake it up. If that doesn’t help, please restart the app.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md border border-border/70 bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
