"use client";

import { create } from 'zustand';

type UiState = {
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  selectedWorkspace: string;
  setSelectedWorkspace: (value: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  selectedWorkspace: 'demo',
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  setSelectedWorkspace: (value) => set({ selectedWorkspace: value })
}));
