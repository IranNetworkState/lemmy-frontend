import { Component, linkEvent } from "inferno";
import { RouteComponentProps } from "inferno-router/dist/Route";
import { GetSiteResponse, LoginResponse } from "lemmy-js-client";
import { refreshTheme } from "@utils/browser";
import { setIsoData } from "@utils/app";
import {
  I18NextService,
  UserService,
  HttpService,
  UnreadCounterService,
} from "../../services";
import {
  EMPTY_REQUEST,
  LOADING_REQUEST,
  RequestState,
} from "../../services/HttpService";
import { toast } from "../../toast";
import { HtmlTags } from "../common/html-tags";
import { Spinner } from "../common/icon";
import PasswordInput from "../common/password-input";
import TotpModal from "../common/modal/totp-modal";

interface State {
  loginRes: RequestState<LoginResponse>;
  form: { username_or_email: string; password: string };
  siteRes: GetSiteResponse;
  show2faModal: boolean;
}

export class AdminLogin extends Component<RouteComponentProps<{}>, State> {
  private isoData = setIsoData(this.context);

  state: State = {
    loginRes: EMPTY_REQUEST,
    form: { username_or_email: "", password: "" },
    siteRes: this.isoData.site_res,
    show2faModal: false,
  };

  constructor(props: any, context: any) {
    super(props, context);
    this.handleSubmitTotp = this.handleSubmitTotp.bind(this);
  }

  // This is the CRITICAL part for security on the UI side.
  async handleLoginSuccess(loginRes: LoginResponse) {
    // Temporarily set auth to fetch the full user profile
    UserService.Instance.login({ res: loginRes, showToast: false });
    const siteResponse = await HttpService.client.getSite();

    if (
      siteResponse.state === "success" &&
      siteResponse.data.my_user?.local_user_view.local_user.admin
    ) {
      // User is an admin, complete the login
      UserService.Instance.myUserInfo = siteResponse.data.my_user;
      refreshTheme();
      toast(I18NextService.i18n.t("logged_in_as_admin"), "success");
      this.props.history.replace("/admin"); // Redirect to admin settings
      UnreadCounterService.Instance.updateAll();
    } else {
      // User is NOT an admin, log them out immediately.
      toast(I18NextService.i18n.t("not_an_administrator"), "danger");
      UserService.Instance.logout(); // This will clear the cookie and reload.
    }
  }

  async handleLoginSubmit(event: any) {
    event.preventDefault();
    const { password, username_or_email } = this.state.form;

    if (username_or_email && password) {
      this.setState({ loginRes: LOADING_REQUEST });
      const loginRes = await HttpService.client.login({
        username_or_email,
        password,
      });

      if (loginRes.state === "success") {
        this.handleLoginSuccess(loginRes.data);
      } else if (loginRes.state === "failed") {
        if (loginRes.err.name === "missing_totp_token") {
          this.setState({ show2faModal: true });
        } else {
          toast(I18NextService.i18n.t(loginRes.err.name), "danger");
        }
        this.setState({ loginRes: EMPTY_REQUEST });
      }
    }
  }

  async handleSubmitTotp(totp: string) {
    const loginRes = await HttpService.client.login({
      password: this.state.form.password,
      username_or_email: this.state.form.username_or_email,
      totp_2fa_token: totp,
    });

    const successful = loginRes.state === "success";
    if (successful) {
      this.setState({ show2faModal: false });
      await this.handleLoginSuccess(loginRes.data);
    } else {
      toast(I18NextService.i18n.t("incorrect_totp_code"), "danger");
    }
    return successful;
  }

  handleUsernameChange(event: any) {
    this.setState(p => (p.form.username_or_email = event.target.value.trim()));
  }
  handlePasswordChange(event: any) {
    this.setState(p => (p.form.password = event.target.value));
  }
  handleClose2faModal() {
    this.setState({ show2faModal: false });
  }

  render() {
    return (
      <div className="container-lg">
        <HtmlTags
          title={`Admin Login - ${this.state.siteRes.site_view.site.name}`}
          path={this.props.location.pathname}
        />
        <TotpModal
          type="login"
          onSubmit={this.handleSubmitTotp}
          show={this.state.show2faModal}
          onClose={linkEvent(this, this.handleClose2faModal)}
        />
        <div className="row">
          <div className="col-12 col-lg-6 offset-lg-3">
            <form onSubmit={linkEvent(this, this.handleLoginSubmit)}>
              <h1 className="h4 mb-4">
                {I18NextService.i18n.t("admin_login")}
              </h1>
              <div className="mb-3 row">
                <label className="col-sm-2 col-form-label">
                  {I18NextService.i18n.t("username")}
                </label>
                <div className="col-sm-10">
                  <input
                    type="text"
                    className="form-control"
                    value={this.state.form.username_or_email}
                    onInput={linkEvent(this, this.handleUsernameChange)}
                    required
                  />
                </div>
              </div>
              <PasswordInput
                id="admin-password"
                value={this.state.form.password}
                onInput={linkEvent(this, this.handlePasswordChange)}
                label={I18NextService.i18n.t("password")}
              />
              <div className="mb-3 row">
                <div className="col-sm-10 offset-sm-2">
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={this.state.loginRes.state === "loading"}
                  >
                    {this.state.loginRes.state === "loading" ? (
                      <Spinner />
                    ) : (
                      I18NextService.i18n.t("login")
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}
