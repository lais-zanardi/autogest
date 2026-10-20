import { create } from 'zustand';
import { Vehicle, User, Refuel, DashboardStats, DashboardIndicators } from '@autogest/shared-types';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isBiometricsLocked: boolean;
  isLoadingAuth: boolean;
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  refuels: Refuel[];
  stats: DashboardStats | null;
  dashboardIndicators: DashboardIndicators | null;
  isLoadingDashboard: boolean;
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncAt: string | null;
  pendingSyncCount: number;
  setUser: (user: User | null) => void;
  setAuth: (user: User | null, isAuthenticated: boolean) => void;
  setBiometricsLocked: (locked: boolean) => void;
  setIsLoadingAuth: (loading: boolean) => void;
  logout: () => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  setRefuels: (refuels: Refuel[], stats: DashboardStats) => void;
  setDashboardIndicators: (indicators: DashboardIndicators | null) => void;
  setIsLoadingDashboard: (loading: boolean) => void;
  setOnlineStatus: (status: boolean) => void;
  setSyncState: (
    status: 'idle' | 'syncing' | 'synced' | 'error',
    lastSyncAt?: string,
    pendingCount?: number,
  ) => void;
}

export const useAppStore = create<AppState>(set => ({
  user: null,
  isAuthenticated: false,
  isBiometricsLocked: false,
  isLoadingAuth: true,
  vehicles: [],
  selectedVehicle: null,
  refuels: [],
  stats: null,
  dashboardIndicators: null,
  isLoadingDashboard: false,
  isOnline: true,
  syncStatus: 'idle',
  lastSyncAt: null,
  pendingSyncCount: 0,
  setUser: user => set({ user, isAuthenticated: !!user }),
  setAuth: (user, isAuthenticated) => set({ user, isAuthenticated }),
  setBiometricsLocked: isBiometricsLocked => set({ isBiometricsLocked }),
  setIsLoadingAuth: isLoadingAuth => set({ isLoadingAuth }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isBiometricsLocked: false,
      vehicles: [],
      selectedVehicle: null,
      refuels: [],
      stats: null,
      dashboardIndicators: null,
      isLoadingDashboard: false,
      syncStatus: 'idle',
      lastSyncAt: null,
      pendingSyncCount: 0,
    }),
  setVehicles: vehicles =>
    set(state => {
      const activeVehicleStillExists = state.selectedVehicle
        ? vehicles.find(v => v.id === state.selectedVehicle?.id)
        : null;
      return {
        vehicles,
        selectedVehicle: activeVehicleStillExists || vehicles[0] || null,
      };
    }),
  setSelectedVehicle: selectedVehicle => set({ selectedVehicle }),
  setRefuels: (refuels, stats) => set({ refuels, stats }),
  setDashboardIndicators: dashboardIndicators => set({ dashboardIndicators }),
  setIsLoadingDashboard: isLoadingDashboard => set({ isLoadingDashboard }),
  setOnlineStatus: isOnline => set({ isOnline }),
  setSyncState: (syncStatus, lastSyncAt, pendingSyncCount) =>
    set(state => ({
      syncStatus,
      lastSyncAt: lastSyncAt !== undefined ? lastSyncAt : state.lastSyncAt,
      pendingSyncCount: pendingSyncCount !== undefined ? pendingSyncCount : state.pendingSyncCount,
    })),
}));
