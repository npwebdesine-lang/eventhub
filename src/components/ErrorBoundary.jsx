import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Catches runtime errors in the component tree and shows a Hebrew fallback UI.
 * Wrap each route individually in App.jsx so one page crash doesn't kill navigation.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50"
          dir="rtl"
        >
          <div className="bg-white rounded-[2.5rem] p-8 shadow-lg max-w-sm w-full text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={36} className="text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">משהו השתבש</h2>
            <p className="text-slate-500 font-medium mb-8 text-sm leading-relaxed">
              קרתה שגיאה בלתי צפויה.<br />
              נסו לרענן את הדף.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-[1.2rem] transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              רענן את הדף
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
