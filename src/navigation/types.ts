import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  LiveMap: undefined;
  RequestPermission: undefined;
  RequestOvertime: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ChangePin: undefined;
  Leave: undefined;
  RequestLeave: undefined;
};

export type AppTabParamList = {
  Dashboard: NavigatorScreenParams<DashboardStackParamList> | undefined;
  CheckIn: undefined;
  History: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
