import { ApplicationInsightsVersion, createWinstonLogger } from '@shellicar/winston-azure-application-insights';
import applicationinsights from 'applicationinsights';

applicationinsights.setup().start();

export const logger = createWinstonLogger({
  insights: {
    client: applicationinsights.defaultClient,
    version: ApplicationInsightsVersion.V3,
  },
  winston: {
    console: {
      enabled: process.env.CONTAINER_APP_NAME === undefined,
    },
  },
});
