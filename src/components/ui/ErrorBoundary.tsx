'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { BodyText } from './Typography';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AppError {
  message: string;
  details?: string;
}

interface State {
  hasError: boolean;
  error?: AppError;
}

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: {
        message: error.message || 'An unexpected error occurred',
        ...(error.stack ? { details: error.stack } : {})
      }
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In production, you might want to send this to an error monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  override render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-primary p-6">
          <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
            <div className="mb-4">
              <div className="text-6xl mb-4">😵</div>
              <BodyText size="2xl" className="font-bold text-primary mb-2">
                Oops! Something went wrong
              </BodyText>
              <BodyText size="base" className="text-gray-600 mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </BodyText>
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors duration-200 font-semibold"
            >
              Reload Page
            </button>
            
            {process.env.NODE_ENV === 'development' && this.state.error?.details && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Show Error Details
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                  {this.state.error.details}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
} 
