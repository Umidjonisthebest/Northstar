import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError.bind(this));
      }
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button className="btn btn-primary" onClick={this.resetError.bind(this)}>
            Try again
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details style={{ marginTop: 20, textAlign: "left" }}>
              <summary style={{ cursor: "pointer", color: "var(--ink-soft)" }}>Error details</summary>
              <pre style={{ marginTop: 10, padding: 10, background: "var(--bg)", borderRadius: 8, overflow: "auto", fontSize: 12 }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack && `\n\n${this.state.errorInfo.componentStack}`}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }

  resetError() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }
}