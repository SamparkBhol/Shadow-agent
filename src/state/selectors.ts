import type { AppState } from "./store";

export const selectSuggestions = (s: AppState) => s.suggestions;
export const selectTopSuggestion = (s: AppState) => s.suggestions[0] ?? null;
export const selectStats = (s: AppState) => s.stats;
export const selectGraph = (s: AppState) => s.graph;
export const selectStatus = (s: AppState) => s.status;
export const selectSettings = (s: AppState) => s.settings;
export const selectReady = (s: AppState) => s.ready;
export const selectPrompt = (s: AppState) => s.prompt;
export const selectHistory = (s: AppState) => s.history;
