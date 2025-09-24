import { Component } from "inferno";
import { I18NextService, UserService } from "../../services";
import { Spinner } from "../common/icon";
import { toast } from "../../toast";
import io, { Socket } from "socket.io-client";

interface WebQRLoginState {
  qrCodeUrl?: string;
  qrToken?: string;
  status:
    | "generating"
    | "waiting"
    | "scanned"
    | "authenticated"
    | "expired"
    | "error";
  errorMessage?: string;
}

interface QRStatusUpdate {
  status: "scanned" | "expired" | "cancelled";
}

interface QRAuthSuccess {
  lemmyAuth: { jwt: string };
}

interface QRCodeRefreshed {
  newQrCodeDataUrl: string;
  newQrToken: string;
}

export class WebQRLogin extends Component<any, WebQRLoginState> {
  private socket: Socket | null = null;

  state: WebQRLoginState = {
    status: "generating",
  };

  componentDidMount() {
    this.generateQRCode();
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  async generateQRCode() {
    this.setState({ status: "generating" });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(`http://127.0.0.1:3001/auth/qr/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: `web-session-${Date.now()}`,
          userAgent: navigator.userAgent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(I18NextService.i18n.t("failed_to_generate_qr"));
      }

      const data = await response.json();
      this.setState({
        qrCodeUrl: data.qrCodeUrl,
        qrToken: data.qrToken,
        status: "waiting",
      });

      this.connectWebSocket(data.qrToken);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("QR generation error:", error);
      let errorMessage =
        (error as Error).message ||
        I18NextService.i18n.t("qr_generation_failed");
      if (error.name === "AbortError") {
        errorMessage =
          "Request timed out. Please check if the backend is running.";
      }
      this.setState({
        status: "error",
        errorMessage,
      });
    }
  }

  connectWebSocket(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(`http://127.0.0.1:3001/qr-auth`, {
      transports: ["websocket"],
      forceNew: true,
    });

    this.socket.on("connect", () => {
      console.log("WebSocket connected for QR auth");
      this.socket?.emit("join-qr-session", { qrToken: token });
    });

    this.socket.on("qr-status-update", (statusData: QRStatusUpdate) => {
      if (statusData.status === "scanned") {
        this.setState({ status: "scanned" });
      } else if (statusData.status === "expired") {
        this.setState({ status: "expired" });
      } else if (statusData.status === "cancelled") {
        this.setState({ status: "expired" }); // Treat cancelled as expired for UI
      }
    });

    this.socket.on("qr-auth-success", (authData: QRAuthSuccess) => {
      if (authData.lemmyAuth && authData.lemmyAuth.jwt) {
        this.handleAuthentication(authData.lemmyAuth.jwt);
      } else {
        console.error(
          "QR Auth Success event received without a valid JWT.",
          authData,
        );
        this.setState({
          status: "error",
          errorMessage: "Authentication failed to return a session.",
        });
      }
    });

    this.socket.on("qr-code-refreshed", (refreshData: QRCodeRefreshed) => {
      this.setState({
        qrCodeUrl: refreshData.newQrCodeDataUrl,
        qrToken: refreshData.newQrToken,
        status: "waiting",
      });
      this.socket?.emit("join-qr-session", { qrToken: refreshData.newQrToken });
    });

    this.socket.on("connect_error", error => {
      console.error("WebSocket connection error:", error);
      this.setState({
        status: "error",
        errorMessage: I18NextService.i18n.t("websocket_connection_failed"),
      });
    });

    this.socket.on("error", (error: any) => {
      console.error("WebSocket error:", error);
      this.setState({
        status: "error",
        errorMessage: error.message || I18NextService.i18n.t("websocket_error"),
      });
    });
  }

  handleAuthentication(lemmyJwt: string) {
    this.setState({ status: "authenticated" });
    if (this.socket) {
      this.socket.disconnect();
    }

    toast(I18NextService.i18n.t("login_successful"), "success");
    UserService.Instance.login({
      res: {
        jwt: lemmyJwt,
        registration_created: false,
        verify_email_sent: false,
      },
    });

    // Redirect handled by UserService
    setTimeout(() => {
      if (window.location.pathname.includes("/login")) {
        window.location.href = "/";
      } else {
        window.location.reload();
      }
    }, 1500);
  }

  renderStatus() {
    switch (this.state.status) {
      case "generating":
        return <p>{I18NextService.i18n.t("generating_qr_code")}</p>;
      case "waiting":
        return <p>{I18NextService.i18n.t("scan_qr_with_app")}</p>;
      case "scanned":
        return <p>{I18NextService.i18n.t("qr_scanned_confirm_on_device")}</p>;
      case "authenticated":
        return <p>{I18NextService.i18n.t("login_successful_redirecting")}</p>;
      case "expired":
        return (
          <>
            <p>{I18NextService.i18n.t("qr_code_expired")}</p>
            <button
              className="btn btn-primary"
              onClick={() => this.generateQRCode()}
            >
              {I18NextService.i18n.t("generate_new_code")}
            </button>
          </>
        );
      case "error":
        return <p className="text-danger">{this.state.errorMessage}</p>;
      default:
        return null;
    }
  }

  render() {
    const { status, qrCodeUrl } = this.state;
    const isLoading = status === "generating" || status === "authenticated";

    return (
      <div className="d-flex flex-column align-items-center text-center">
        <h1 className="h4 mb-4">
          {I18NextService.i18n.t("login_with_qr_code")}
        </h1>
        <div className="qr-container my-3 d-flex align-items-center justify-content-center">
          {isLoading && <Spinner large />}
          {qrCodeUrl && !isLoading && status !== "expired" && (
            <img
              src={qrCodeUrl}
              alt={I18NextService.i18n.t("login_qr_code_alt")}
              width="256"
              height="256"
            />
          )}
        </div>
        <div className="status-message mt-3">{this.renderStatus()}</div>
      </div>
    );
  }
}
