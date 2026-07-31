import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeSection: string;
  adminTab: number;
  setSidebarOpen: (open: boolean) => void;
  setActiveSection: (section: string) => void;
  setAdminTab: (tab: number) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeSection: 'Main',
  adminTab: 0,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveSection: (section) => set({ activeSection: section }),
  setAdminTab: (tab) => set({ adminTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
