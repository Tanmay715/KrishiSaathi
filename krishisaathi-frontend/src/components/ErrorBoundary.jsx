import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { has_error: false };
  }

  static getDerivedStateFromError() {
    return { has_error: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleRetry = () => {
    this.setState({ has_error: false });
  };

  render() {
    if (this.state.has_error) {
      return (
        <div className="error-state" role="alert">
          <p>{this.props.fallback_message || 'Something went wrong.'}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
