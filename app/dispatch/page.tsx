"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import DispatchClient from "./dispatch-client";

class DispatchBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dispatch kunde inte renderas", error, info);
  }

  render() {
    if (this.state.failed)
      return (
        <main className="portal">
          <section className="portalcard">
            <img src="/avenyn-logo-optimized.webp" width="88" height="88" alt="Avenyn Taxi" />
            <h1>Dispatch</h1>
            <div className="notice">
              Trafikledningen kunde inte visas. Ingen data har ändrats.
            </div>
            <button type="button" onClick={() => window.location.reload()}>
              Försök igen
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}

export default function Dispatch() {
  return (
    <DispatchBoundary>
      <DispatchClient />
    </DispatchBoundary>
  );
}
