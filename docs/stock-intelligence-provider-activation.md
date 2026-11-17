# Stock Intelligence market-data activation

PRISM does not obtain, store, rank, forecast, or redistribute exchange data
until an approved provider adapter and a valid commercial entitlement are both
in place. A public chart widget may be used as a display-only preview; it is
not an ingestion source.

## Approval gate

Before enabling an adapter, the business owner must retain written confirmation
that the intended subscription permits PRISM's exact use: internal analytics,
browser display, historical storage, derived analytics, exports, and any
redistribution to PRISM users. Broker API access alone is not evidence of
redistribution rights.

## Required deployment configuration

Inject these values from Secret Manager into the existing Cloud Run service;
never set them in `NEXT_PUBLIC_*`, commit them, or paste them into a browser.

```text
MARKET_DATA_PROVIDER=<registered-adapter-name>
MARKET_DATA_API_KEY=<secret-manager-reference>
MARKET_DATA_BASE_URL=<provider-api-base-url>
```

`MARKET_DATA_PROVIDER` must exactly match a server-side adapter registered in
`backend/lib/market-data-provider.ts`. The status API deliberately remains
`unregistered` until an adapter is reviewed and added. This prevents a random
environment value from being treated as a working feed.

## Adapter acceptance checklist

1. Validate credentials server-side with a least-privilege provider endpoint.
2. Declare only entitled capabilities: instrument master, quotes, EOD history,
   intraday, fundamentals, indices, announcements, news, or macro data.
3. Normalize every record with source URL, provider name, source timestamp,
   fetched timestamp, and live/delayed/EOD classification.
4. Use `executeProviderRequest` for bounded timeout, retry, cache, and circuit
   breaker handling.
5. Run fixture-based adapter tests, then a non-production provider smoke test.
6. Enable display, persistence, CSV export, rankings, and forecasts only for
   capabilities explicitly permitted by the provider agreement.

## Operational behavior

The UI shows a single source-status area. Missing provider data remains
unavailable; it is never converted to zero, synthetic market observations, or
forecast confidence. Rankings require an eligible, fresh, source-attributed
universe. Forecast probabilities remain suppressed until walk-forward
calibration is complete.
