import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  LiveMap: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ChangePin: undefined;
  // Leave/RequestLeave moved to the Requests tab — kept off this list now
  // that ProfileScreen no longer links to them directly.
  History: undefined;
};

export type AppTabParamList = {
  Dashboard: NavigatorScreenParams<DashboardStackParamList> | undefined;
  CheckIn: undefined;
  // Replaces the old top-level History tab — Leave, Permission and Overtime
  // consolidated into one tabbed screen (see RequestsScreen). `tab` lets a
  // caller (e.g. Dashboard's shortcut buttons) land directly on a specific
  // segment instead of always defaulting to Leave.
  Requests: { tab?: "leave" | "permission" | "overtime" } | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
