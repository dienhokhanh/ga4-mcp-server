import { AnalyticsAdminServiceClient, v1beta as adminV1beta } from "@google-analytics/admin";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { AuthOptions } from "./auth.js";

export type DataClient = InstanceType<typeof BetaAnalyticsDataClient>;
export type AdminClient = InstanceType<typeof adminV1beta.AnalyticsAdminServiceClient>;
export type AdminAlphaClient = InstanceType<typeof AnalyticsAdminServiceClient>;

/** Google API clients, created lazily so the server starts even before credentials are valid. */
export interface Ga4Clients {
  readonly data: DataClient;
  readonly admin: AdminClient;
  /** v1alpha Admin API — only used for endpoints not yet in v1beta (audiences). */
  readonly adminAlpha: AdminAlphaClient;
}

export function createClients(authOptions: AuthOptions): Ga4Clients {
  let data: DataClient | undefined;
  let admin: AdminClient | undefined;
  let adminAlpha: AdminAlphaClient | undefined;
  return {
    get data() {
      return (data ??= new BetaAnalyticsDataClient(authOptions));
    },
    get admin() {
      return (admin ??= new adminV1beta.AnalyticsAdminServiceClient(authOptions));
    },
    get adminAlpha() {
      return (adminAlpha ??= new AnalyticsAdminServiceClient(authOptions));
    },
  };
}
