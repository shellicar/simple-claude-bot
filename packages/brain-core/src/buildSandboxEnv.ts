import { ENV_PASSTHROUGH } from './consts';

export function buildSandboxEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENV_PASSTHROUGH) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  return env;
}
