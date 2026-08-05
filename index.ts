// Must be the very first import — react-native-gesture-handler installs
// global native event handling that everything else (React Navigation's
// native-stack transitions in particular) depends on.
import "react-native-gesture-handler";

import { registerRootComponent } from "expo";

// Registers the TaskManager background-location task at JS-engine startup,
// so it's defined even when iOS/Android relaunches the app headlessly to
// deliver a background location update (no screen ever mounts in that case).
import "./src/services/locationTracking";

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
