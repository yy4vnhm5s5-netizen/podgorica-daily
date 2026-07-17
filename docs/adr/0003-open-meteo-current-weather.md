# ADR 0003: Use Open-Meteo for current weather

- Status: Accepted
- Date: 2026-07-17

## Context

Sprint 4 introduces current weather for Podgorica. The product needs a source with a server-consumable current-conditions endpoint, no client-side credentials, documented weather variables, and an exit path if reliability, licensing, or operational requirements change.

## Decision

Use the Open-Meteo Forecast API from the Weather module’s infrastructure layer for current conditions only. Request temperature, relative humidity, apparent temperature, weather code, wind speed, and the observation time for Podgorica. Fetch on the server, validate every response with Zod, cache successful responses for ten minutes, and present Open-Meteo attribution with the displayed freshness timestamp.

## Consequences

- The first weather capability ships without storing an API key or exposing a provider request to the browser.
- The provider payload remains isolated to `src/modules/weather/infrastructure`; the application layer maps it to a module-owned contract.
- A malformed response, missing current observation, or non-success response becomes a safe error or empty state rather than a provider error shown to users.
- Open-Meteo does not remove the need for future availability monitoring, provider review, or an adapter replacement strategy.
