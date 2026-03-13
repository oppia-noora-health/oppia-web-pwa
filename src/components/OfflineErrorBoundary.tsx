"use client";

import React from "react";
import { OfflinePageUnavailable } from "@/components/OfflinePageUnavailable";

interface OfflineErrorBoundaryProps {
  children: React.ReactNode;
}

interface OfflineErrorBoundaryState {
  hasError: boolean;
  errorCount: number;
}

export class OfflineErrorBoundary extends React.Component<
  OfflineErrorBoundaryProps,
  OfflineErrorBoundaryState
> {
  private errorResetTimer: NodeJS.Timeout | null = null;

  constructor(props: OfflineErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(): OfflineErrorBoundaryState {
    return { hasError: true, errorCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[OfflineErrorBoundary] Caught error:", error, errorInfo);

    // Increment error count
    this.setState((prev) => ({
      errorCount: prev.errorCount + 1,
    }));

    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
    }

    this.errorResetTimer = setTimeout(() => {
      console.log("[OfflineErrorBoundary] Auto-resetting error state");
      this.setState({ hasError: false, errorCount: 0 });
    }, 5000);
  }

  componentWillUnmount() {
    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      return <OfflinePageUnavailable />;
    }
    return this.props.children;
  }
}
