export interface ClientConfig {
  remoteUrl: string;
  defaultModel?: string;
  defaultConfig?: string;
}

export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  remoteUrl: 'http://localhost:3333',
};
