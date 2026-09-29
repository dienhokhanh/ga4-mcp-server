# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-29

### Added

- Initial release.
- Discovery tools: `list_accounts`, `list_properties`, `get_property`, `list_data_streams`.
- Metadata tools: `get_metadata`, `check_compatibility`.
- Reporting tools: `run_report`, `batch_run_reports`, `run_pivot_report`, `run_realtime_report`.
- Admin read tools: `list_custom_dimensions`, `list_custom_metrics`, `list_key_events`, `list_audiences`.
- Opt-in write tools (`GA4_MCP_ENABLE_WRITES=true`): `create_custom_dimension`, `create_custom_metric`, `create_key_event`, `archive_custom_dimension`, `archive_custom_metric`.
- Prompts: `weekly_traffic_summary`, `top_landing_pages`, `channel_performance`.
- Authentication via service account, browser sign-in (`ga4-mcp-server auth`) or Application Default Credentials.
- Property lookup by display name, compact report output, row cap and friendly error messages.
