import type { ReactNode } from "react";
import { Component } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f5f0] px-6">
        <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="font-display text-xl font-bold text-[#0b0f19]">
            Something crashed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Try reloading. If this keeps happening, the message below helps pinpoint it.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {this.state.message}
          </pre>
          <button
            type="button"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[#0b0f19] px-5 text-sm font-semibold text-white hover:bg-[#0b0f19]/90"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

