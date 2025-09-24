import { Component } from 'inferno';
import { I18NextService } from '../../services';
import { toast } from '../../toast';
import { isBrowser } from '@utils/browser';
import { Spinner } from '../common/icon';

interface MobileSSOState {
  isSigningIn: boolean;
}

export class MobileSSO extends Component<any, MobileSSOState> {
  state: MobileSSOState = {
    isSigningIn: false,
  };

  constructor(props: any, context: any) {
    super(props, context);
    this.handleSignInClick = this.handleSignInClick.bind(this);
  }

  handleSignInClick() {
    // Prevent the user from tapping the button multiple times
    if (this.state.isSigningIn) return;
    
    this.setState({ isSigningIn: true });

    // This is the message we will send to the React Native host app.
    // It's a simple, clear action request.
    const message = { action: 'requestForumSSO' };

    // 'window.ReactNativeWebView.postMessage' is the standard bridge
    // for communicating from a WebView to a React Native app.
    if (isBrowser() && (window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    } else {
      // This is a fallback for testing in a desktop browser.
      const errorMessage = 'Error: SSO bridge not detected. This feature is only available within the app.';
      console.error(errorMessage);
      toast(I18NextService.i18n.t('sso_error_bridge_not_found', { defaultValue: errorMessage }), 'danger');
      this.setState({ isSigningIn: false });
    }
  }

  render() {
    return (
      <div className="d-flex flex-column align-items-center text-center">
        <h1 className="h4 mb-4">{I18NextService.i18n.t('forum_access', {defaultValue: 'Forum Access'})}</h1>
        <p>{I18NextService.i18n.t('sign_in_to_access_forum', {defaultValue: 'Sign in to continue to the forum.'})}</p>
        <button 
          className="btn btn-primary btn-lg my-3" 
          onClick={this.handleSignInClick}
          disabled={this.state.isSigningIn}
        >
          {this.state.isSigningIn ? (
            <Spinner />
          ) : (
            I18NextService.i18n.t('sign_in_to_forum', {defaultValue: 'Sign In to Forum'})
          )}
        </button>
      </div>
    );
  }
}