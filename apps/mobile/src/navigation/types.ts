import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Garage: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  BiometricLock: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  NewFuelingModal: undefined;
};
