// src/components/ui/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ErrorBoundary caught an error:', error, errorInfo);
    
    // Handle Event objects specifically
    if (error instanceof Event) {
      console.error('❌ Event object caught by ErrorBoundary:', error);
      const eventError = new Error(`Event object: ${error.type}`);
      eventError.stack = `Event type: ${error.type}, Event target: ${error.target}`;
      this.setState({
        error: eventError,
        errorInfo
      });
    } else {
      this.setState({
        error,
        errorInfo
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <FaExclamationTriangle className="error-icon" />
            <h2>Something went wrong</h2>
            <p>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre className="error-stack">
                  {this.state.error.stack}
                </pre>
                {this.state.errorInfo && (
                  <pre className="error-info">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
            
            <button 
              className="error-reset-button"
              onClick={this.handleReset}
            >
              <FaRedo /> Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
