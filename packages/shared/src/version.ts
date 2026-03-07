import versionInfo from '@shellicar/build-version/version';
import type { VersionResponse } from './shared/types';

export const Version = {
  ...versionInfo,
  node: process.version,
  CONTAINER_APP_REPLICA_NAME: process.env.CONTAINER_APP_REPLICA_NAME ?? '',
  CONTAINER_APP_REVISION: process.env.CONTAINER_APP_REVISION ?? '',
} satisfies VersionResponse;
