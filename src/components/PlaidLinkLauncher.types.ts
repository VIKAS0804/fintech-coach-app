export interface PlaidLinkSuccessPayload {
  accountsCount: number;
  institutionName: string | null;
  linkSessionId: string | null;
  publicToken: string;
}

export interface PlaidLinkLauncherProps {
  disabled?: boolean;
  onLinkTokenCreated?: (token: string | null) => void;
  onStatusChange?: (message: string) => void;
  onSuccess: (payload: PlaidLinkSuccessPayload) => void | Promise<void>;
}
