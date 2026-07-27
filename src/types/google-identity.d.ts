interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleIdentityIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce: string;
  ux_mode: 'popup';
}

interface GoogleIdentityButtonConfiguration {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  text: 'signin_with';
  shape: 'rectangular';
  logo_alignment: 'left';
  locale: 'ko';
  width?: number;
  click_listener?: () => void;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(configuration: GoogleIdentityIdConfiguration): void;
      renderButton(parent: HTMLElement, configuration: GoogleIdentityButtonConfiguration): void;
      disableAutoSelect(): void;
    };
  };
}

interface Window {
  google?: GoogleIdentityServices;
}
