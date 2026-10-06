import React from 'react';
import { Button } from './ui/button';

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
      <div className="min-h-[60vh] flex items-center justify-center px-4" role="alert" data-testid="page-load-error">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">This page didn't load</h2>
          <p className="text-gray-600 mb-4">Your connection may have dropped. Check it and try again.</p>
          <Button onClick={() => window.location.reload()} className="bg-emerald-600 hover:bg-emerald-700">
            Retry
          </Button>
        </div>
      </div>
    );
  }
}

export const PageFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center text-gray-600" role="status">
    Loading…
  </div>
);
