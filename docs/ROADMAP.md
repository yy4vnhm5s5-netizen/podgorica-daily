# Roadmap

## Sprint 0 — Specification

Create and review the project documentation and GitHub issues. No application code is introduced.

## Foundation — Complete (v0.1.0-foundation)

Bootstrapped the runtime, quality gates, UI system, environment validation, container build, delivery pipeline, architecture decision records, application shell, feature flags, and engineering handbook. Product modules remain intentionally unimplemented.

## Trusted local data

Current weather for Podgorica is delivered through an isolated Open-Meteo adapter with attribution, freshness, and safe loading, empty, and error states. Transport and events remain future independently deployable increments; each requires provenance, stale-data behaviour, monitoring, and accessible states.

City Alerts reads cached official CEDIS planned power outages when a collector snapshot is available. It exposes fresh, stale, and unavailable states with source attribution. Mock alerts remain an explicit development-only provider mode; further sources still require their own approved provider contracts, attribution, freshness, outage handling, and monitoring.

## Discovery and operations

Add maps, unified search, secure identity, and editorial administration. Introduce the smallest data model and operational workflow required by approved content sources.

## Deterministic daily overview and hardening

Daily Overview is a zero-cost, deterministic summary generated from normalized cached city data. It can consume generic normalized CEDIS power-outage read-model data without depending on CEDIS infrastructure. Add durable cache persistence, scheduled collection operations, provenance review, monitoring, and further approved source contracts before broad production rollout.
