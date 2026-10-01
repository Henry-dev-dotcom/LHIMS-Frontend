import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

// Legacy demo-store key plus the cached session profile; clearing both gives
// a clean recovery when corrupted local data breaks a screen.
const LOCAL_KEYS = ['diagnosis-center-change-pack-v1-state', 'diagnosis-center-live-api-tokens'];

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'The app could not render this screen.'
    };
  }

  componentDidCatch(error, info) {
    // Keep the production app from going blank while still surfacing enough context in dev tools.
    console.error('LHIMS UI error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      LOCAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Reload anyway if storage is unavailable.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-app-radial px-4 py-8 text-slate-900" role="main">
        <section className="w-full max-w-lg rounded-[1.75rem] border border-white/80 bg-white/95 p-5 text-center shadow-panel backdrop-blur-xl sm:p-8" role="alert" aria-live="assertive">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Something interrupted this screen</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The app stayed online, but this screen could not finish loading. Reload the app, or clear the saved local state if the issue came from corrupted local data.
          </p>
          {this.state.errorMessage && (
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">{this.state.errorMessage}</p>
          )}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button onClick={this.handleReload} className="w-full">
              <RotateCcw className="h-4 w-4" /> Reload app
            </Button>
            <Button variant="secondary" onClick={this.handleReset} className="w-full">
              Reset saved state
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
