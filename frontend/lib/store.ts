"use client";

import { create } from "zustand";
import type { Architecture, PersonaId } from "./types";

interface DemoState {
  persona: PersonaId | null;
  architecture: Architecture;
  setPersona: (p: PersonaId) => void;
  setArchitecture: (a: Architecture) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  persona: "affluent",
  architecture: "agentic",
  setPersona: (persona) => set({ persona }),
  setArchitecture: (architecture) => set({ architecture }),
}));

let counter = 0;
export function newSessionId(prefix = "ui") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
