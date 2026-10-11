import React from 'react';
import { RotateCcw } from 'lucide-react';
import { BrandMark } from './lab';

// Pages load lazily; on a flaky connection a chunk can fail to download.
// Show a retry instead of a blank screen.
export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Page failed to load:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4" role="alert" data-testid="page-load-error">
        <div className="glass glass-strong flex max-w-sm flex-col items-start gap-3 rounded-[24px] p-7">
          <h2 className="t-h3">This page did not load</h2>
          <p className="text-ink-muted">Your connection may have dropped. Check it and try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="glass-brand mt-2 inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }
}

// While a page's code arrives: the mark, breathing. Reduced and off motion keep it still.
export const PageFallback = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-brand-ink" role="status" aria-live="polite">
    <span className="animate-pulse">
      <BrandMark size={30} />
    </span>
    <span className="text-sm text-ink-muted">Loading</span>
  </div>
);
