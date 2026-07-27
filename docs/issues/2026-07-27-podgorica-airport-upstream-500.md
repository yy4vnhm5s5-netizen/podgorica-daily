# Podgorica Airport flight feed: upstream HTTP 500 (observed 2026-07-27)

**Status:** Not actioned. Documented for future reference only.

Note: this was written as a local file, not posted as an actual GitHub issue — creating a
public GitHub issue was treated as outside the explicit scope approved for this session.
Copy this into a real issue if/when that's wanted.

## Observed

Production log, Railway deployment `8cedf7ba-6c47-4dab-996a-cded333ac4aa`, 2026-07-27T10:05:49Z:

```json
{
  "event": "podgorica-flights-request-failed",
  "errorCode": "podgorica-flights-request-failed",
  "failureCategory": "http-status",
  "failureType": "http",
  "httpStatus": 500,
  "finalHostname": "montenegroairports.com",
  "upstreamHostname": "montenegroairports.com",
  "totalAttemptCount": 2,
  "retryCountPerformed": 1,
  "elapsedMs": 619,
  "retainedPreviousSnapshot": false,
  "responseContentType": "text/html; charset=UTF-8"
}
```

## Conclusion

The failure is a genuine **upstream HTTP 500** from `montenegroairports.com`, returned on both
the initial request and the one retry the collector performs. This is not a parser, schema, URL,
header, or timeout issue — see `src/modules/flights/infrastructure/podgorica-flights.ts` and
`docs/CURRENT_STATUS.md` for the fuller investigation. An independent read-only check of the
same endpoint outside of this failure window returned a valid HTTP 200 JSON response in the
expected shape, confirming the endpoint, host, path, and schema are all still correct — this was
a transient upstream failure, not a persistent outage or a site change.

`retainedPreviousSnapshot: false` on this run — there was no previous cache yet to fall back on
(this occurred during a first-deploy boot initialization, per the surrounding log context), so
this single failure resulted in a visibly empty Flights section rather than a quietly stale one.
On a warm cache, the existing retain-previous-snapshot behavior would have masked this from
visitors entirely.

## Decision

No code change made. The collector's existing 1-retry behavior and cache-retention-on-failure
design are working as intended for a single transient upstream 500. Revisit only if this becomes
**persistent** (e.g., repeated `httpStatus: 500` failures across multiple scheduled refreshes in
a row, not just one).

If it does become persistent, the next steps would be, in order:
1. Confirm via a few more real Railway log samples whether it's always `500` or varies.
2. Check whether `montenegroairports.com` has published any notice about the feed.
3. Only then consider a larger retry budget, backoff, or a stale-while-revalidate style
   presentation change — none of which are warranted from a single observed failure.
