import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Garage: undefined;
  NewRefuelAction: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  BiometricLock: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  NewFuelingModal: undefined;
  CreateBackupModal: undefined;
  RestoreBackupModal: undefined;
  AuditHistoryModal: undefined;
  PreferencesModal: undefined;
  ConsumptionModal: undefined;
  SearchModal: undefined;
  TripModal: undefined;
  EfficiencyGoalsModal: undefined;
  ReportExportModal: undefined;
  VehicleMarketValueModal: undefined;
  MaintenanceScheduleModal: { vehicleId?: string } | undefined;
  ExpenseCategoryChartModal: undefined;
};
