import { NextResponse } from "next/server";
import { getSession } from "@backend/lib/auth";
import { ensureSeeded } from "@backend/lib/bootstrap";
import { env } from "@backend/lib/env";
import { queryBigQuery } from "@backend/lib/bigquery";

export async function GET(req: Request) {
  const user = getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  await ensureSeeded();
  const requestedUser = new URL(req.url).searchParams.get("userId");
  if (requestedUser && requestedUser !== user.email && user.role !== "admin")
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  const userId = requestedUser || user.email;
  const allRecords = user.role === "admin" && !requestedUser;
  const executionFilter = allRecords ? "" : "AND user_id=@userId";
  const auctionFilter = allRecords ? "" : "AND (actor_email=@userId OR subject_user_id=@userId)";
  const rows = await queryBigQuery(`
    SELECT event_ts AS createdAt, 'AI execution' AS category, user_id AS userId, task_type AS action,
      CAST(NULL AS STRING) AS recordId, CAST(NULL AS STRING) AS recordKind, CAST(NULL AS STRING) AS fromStatus,
      CAST(NULL AS STRING) AS toStatus, status, CONCAT(provider, ':', model_id) AS detail
    FROM \`${env.projectId}.${env.dataset}.execution_logs\`
    WHERE tenant=@tenant ${executionFilter}
    UNION ALL
    SELECT created_at AS createdAt, 'Property Auctions' AS category, actor_email AS userId, action,
      record_id AS recordId, record_kind AS recordKind, from_status AS fromStatus, to_status AS toStatus,
      to_status AS status, CONCAT('Affected user: ', subject_user_id) AS detail
    FROM \`${env.projectId}.${env.dataset}.auction_audit_logs\`
    WHERE org_id=@tenant ${auctionFilter}
    ORDER BY createdAt DESC LIMIT 100`, { tenant: user.orgId, ...(allRecords ? {} : { userId }) });
  return NextResponse.json(rows);
}
