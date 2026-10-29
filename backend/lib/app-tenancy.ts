import type { SessionUser } from "./auth";
import type { AppName } from "./app-records";

// Property Auctions is a shared marketplace tenant. Keep the admin's primary
// organization for every other PRISM module, but scope this module's records,
// audit trail and private files to one durable tenant.
export const propertyAuctionsOrgId = "property-auctions";

export function appOrgId(app: AppName, user: Pick<SessionUser, "orgId">) {
  return app === "property-auctions" ? propertyAuctionsOrgId : user.orgId;
}
