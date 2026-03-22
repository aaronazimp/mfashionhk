"use client";

import { useEffect } from "react";

export default function NoConsole() {
  useEffect(() => {
    const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
    for (const m of methods) {
      // @ts-ignore intentionally override console methods
      console[m] = () => {};
    }
  }, []);

  return null;
}
