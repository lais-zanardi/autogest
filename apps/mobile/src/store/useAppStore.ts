import { create } from 'zustand';
import { Vehicle, User, Refuel, DashboardStats } from '@autogest/shared-types';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isBiometricsLocked: boolean;
  isLoadingAuth: boolean;
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  refuels: Refuel[];
  stats: DashboardStats | null;
  isOnline: boolean;
  setUser: (user: User | null) => void;
  setAuth: (user: User | null, isAuthenticated: boolean) => void;
  setBiometricsLocked: (locked: boolean) => void;
  setIsLoadingAuth: (loading: boolean) => void;
  logout: () => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  setRefuels: (refuels: Refuel[], stats: DashboardStats) => void;
  setOnlineStatus: (status: boolean) => void;
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
  isOnline: true,
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
    }),
  setVehicles: vehicles => set({ vehicles, selectedVehicle: vehicles[0] || null }),
  setSelectedVehicle: selectedVehicle => set({ selectedVehicle }),
  setRefuels: (refuels, stats) => set({ refuels, stats }),
  setOnlineStatus: isOnline => set({ isOnline }),
}));
