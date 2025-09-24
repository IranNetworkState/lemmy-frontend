// src/shared/components/auth/AuthenticationRouter.tsx

import { Component } from "inferno";
import { isBrowser } from "@utils/browser";
import { WebQRLogin } from "./WebQRLogin"; // Assumes you've created this
import { MobileSSO } from "./MobileSSO"; // Assumes you've created this
import { Spinner } from "../common/icon";

interface AuthRouterState {
  isAppWebview: boolean;
  detectionComplete: boolean;
}

export class AuthenticationRouter extends Component<any, AuthRouterState> {
  state: AuthRouterState = {
    isAppWebview: false,
    detectionComplete: false, // Start as false to show a loader
  };

  componentDidMount() {
    // This logic only runs on the client-side (in the browser or WebView)
    if (isBrowser()) {
      // Check for the global variable that our React Native app will inject.
      const isWebview = !!(window as any).isIranNationApp;

      console.log(`App WebView detected: ${isWebview}`);

      this.setState({
        isAppWebview: isWebview,
        detectionComplete: true, // Detection is now complete
      });
    }
  }

  render() {
    // While we wait for componentDidMount to run, show a spinner.
    // This prevents a "flash" of the wrong component.
    if (!this.state.detectionComplete) {
      return <Spinner large />;
    }

    // If we detected the app's webview, show the simple SSO button.
    if (this.state.isAppWebview) {
      return <MobileSSO />;
    }
    // Otherwise, for any other browser, show the QR code login.
    else {
      return <WebQRLogin />;
    }
  }
}
