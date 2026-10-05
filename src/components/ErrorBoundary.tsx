import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the route path) clears a captured error. */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-lg p-4"
          style={{ background: 'var(--panel)', border: '1px solid var(--down)' }}>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--down)' }}>This page crashed</h2>
          <p className="text-sm mb-3">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}
            className="btn btn-primary">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
