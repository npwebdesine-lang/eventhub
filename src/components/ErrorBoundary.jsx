import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#eceadf]"
          dir="rtl"
        >
          <div className="bg-[#f0eee7] rounded-[2.25rem] p-8 shadow-[12px_12px_30px_rgba(0,0,0,0.1),-12px_-12px_30px_rgba(255,255,255,0.9)] max-w-sm w-full text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]">
              <AlertTriangle size={36} className="text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              משהו השתבש
            </h2>
            <p className="text-slate-500 font-medium mb-8 text-sm leading-relaxed">
              קרתה שגיאה בלתי צפויה.
              <br />
              נסו לרענן את הדף.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full text-white font-bold py-4 rounded-full transition-all active:scale-[0.97] bg-[#5b6169] hover:bg-[#4a5259] shadow-[5px_5px_14px_rgba(0,0,0,0.14),-4px_-4px_12px_rgba(255,255,255,0.7),inset_2px_2px_4px_rgba(255,255,255,0.2),inset_-2px_-2px_4px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2"
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
