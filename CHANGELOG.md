# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-03

### Added
- Initial release.
- `generate_screen` MCP tool: text prompt → PNG mockup + HTML source.
- `iterate_screen` MCP tool: refine an existing screen with feedback, parent/child tracking.
- `list_screens` and `get_screen` MCP tools for browsing the design library.
- Two model backends:
  - `cli` (default): spawns the local `claude` CLI, uses subscription auth.
  - `api`: uses the Anthropic SDK directly with an API key.
- Stdio and HTTP transports.
- Hand-tuned system prompt for premium iOS aesthetics (HIG type scale, SF Pro fallbacks, no-stock-photo rule, tonal layering).
- Disk-backed storage: HTML + PNG + JSON metadata per screen.
- Docker / docker-compose deployment for HTTP transport.
- iPhone 15 Pro default viewport (390×844 @2x), configurable via env.
