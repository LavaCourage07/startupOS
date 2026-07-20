/**
 * OS.8: Error Boundary
 */
import React from 'react';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.reset = () => {
            this.setState({ hasError: false, error: null });
        };
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }
    render() {
        if (this.state.hasError && this.state.error) {
            const Fallback = this.props.fallback;
            if (Fallback) {
                return <Fallback error={this.state.error} reset={this.reset}/>;
            }
            return (<div className="p-8 text-center">
          <h2 className="text-xl font-bold mb-4">出错了</h2>
          <p className="text-gray-600 mb-4">{this.state.error.message}</p>
          <button onClick={this.reset} className="px-4 py-2 bg-blue-500 text-white rounded">
            重试
          </button>
        </div>);
        }
        return this.props.children;
    }
}
