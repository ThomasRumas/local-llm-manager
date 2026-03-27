export interface ApiModelConfig {
  name: string;
  alias?: string;
}

export interface ApiModel {
  filename: string;
  configs: ApiModelConfig[];
}

export interface ApiModelsResponse {
  models: ApiModel[];
}

export interface ApiStartBody {
  config?: string;
}

export interface ApiStartResponse {
  success: boolean;
  port: number;
  pid: number;
}

export interface ApiStatusResponse {
  running: boolean;
  modelFile: string | null;
  configName: string | null;
  port: number | null;
  pid: number | null;
  uptimeSeconds: number;
  error: string | null;
}

export interface ApiStopResponse {
  success: boolean;
}

export interface ApiErrorResponse {
  error: string;
}
