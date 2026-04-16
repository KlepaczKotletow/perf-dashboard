"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  label?: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Bounds a dashboard widget so a render-time error doesn't nuke the
 * whole page. Drop in around any self-contained card / section that
 * can fail independently of its siblings.
 *
 * Matches Lattice / Culture Amp resilience: the rest of the dashboard
 * still loads even if one widget's data or render blows up, and the
 * user gets a specific message instead of an empty screen.
 */
export class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the message on the console for debugging — no external logger
    // wired up yet. (Phase 6.10 will thin these out across the rest of
    // the codebase; this one stays because it's an error path.)
    console.error("[WidgetErrorBoundary]", this.props.label ?? "", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              This widget couldn&apos;t load{this.props.label ? ` (${this.props.label})` : ""}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              The rest of the page is fine — try refreshing, or{" "}
              <button onClick={this.reset} className="underline hover:no-underline">
                retry this section
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }
}
