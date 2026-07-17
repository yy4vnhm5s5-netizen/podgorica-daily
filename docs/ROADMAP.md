# Roadmap

## Sprint 0 — Specification

Create and review the project documentation and GitHub issues. No application code is introduced.

## Foundation — Complete (v0.1.0-foundation)

Bootstrapped the runtime, quality gates, UI system, environment validation, container build, delivery pipeline, architecture decision records, application shell, feature flags, and engineering handbook. Product modules remain intentionally unimplemented.

## Trusted local data

Current weather for Podgorica is delivered through an isolated Open-Meteo adapter with attribution, freshness, and safe loading, empty, and error states. Transport and events remain future independently deployable increments; each requires provenance, stale-data behaviour, monitoring, and accessible states.

An internal City Alerts demo validates active-alert presentation with mock content only. It does not represent live disruptions. Production alerts require approved provider contracts, attribution, freshness, outage handling, and monitoring for each source.

## Discovery and operations

Add maps, unified search, secure identity, and editorial administration. Introduce the smallest data model and operational workflow required by approved content sources.

## Deterministic daily overview and hardening

Daily Overview is a zero-cost, deterministic summary generated from normalized cached city data. The current provider is explicitly mock data; production requires approved source contracts, scheduled cache refreshes, provenance, freshness, outage handling, and monitoring. Complete performance, security, accessibility, resilience, and operational-readiness reviews before broad production rollout.
