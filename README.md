# Tide

**Tide** is a cross-platform desktop client for **InfluxDB 3.x**. Navicat-style
GUI for browsing schemas, writing SQL, and visualising query results. Runs
100% locally — tokens never leave your machine.

> Supports InfluxDB 3.x only. Not compatible with 1.x or 2.x.
>
> The name is a nod to time series: tides rise and fall on a clock.

## Features

- Manage multiple InfluxDB 3.x connections (tokens stored in the system keychain)
- Browse `Database → Schema → Table → Column` via `information_schema`
- SQL editor powered by Monaco (syntax highlight, Cmd/Ctrl+Enter to run)
- Result grid (AG Grid Community, virtual scrolling, sorting, filtering)
- Line chart for time-series SELECTs (auto-detects `time` + numeric columns)
- Query history per connection, with one-click replay
- Export results to CSV / JSON / NDJSON
- Light / dark theme (follows system)

## Tech stack

- **Shell:** Tauri 2
- **Backend:** Rust + Arrow Flight / FlightSQL (`arrow-flight`, `tonic`)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Editor:** Monaco Editor
- **Grid:** AG Grid Community
- **Chart:** ECharts

## Development

Prerequisites:
- Node.js ≥ 20
- Rust stable (install via `rustup`)
- Xcode command line tools (macOS) / MSVC (Windows)

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Outputs to `src-tauri/target/release/bundle/`:
- macOS: `.app`, `.dmg`
- Windows: `.msi`, `.exe`

## Releasing (multi-platform)

The repo ships a GitHub Actions workflow (`.github/workflows/release.yml`) that
builds installers for macOS (arm64 + x64), Windows (x64) and Linux (x64) on every
`v*` tag and attaches them to a draft GitHub Release.

Cut a release:

```bash
# bump version in package.json + src-tauri/tauri.conf.json + src-tauri/Cargo.toml
git tag v0.1.1
git push origin v0.1.1
```

Watch the run in the repo's Actions tab. When it finishes, open the drafted
Release and publish it.

For initial signing setup, see [`SIGNING.md`](./SIGNING.md).

## Data locations

- Connection profiles (non-sensitive): `~/.tide/connections.json`
- Query history: `~/.tide/history.jsonl`
- Tokens: macOS Keychain / Windows Credential Manager (service `tide`)

## Project layout

```
src/                       frontend (React)
├── components/ui          shadcn/ui primitives
├── features/connection    connection manager
├── features/explorer      database/table tree
├── features/query         editor + grid + chart + history
├── lib                    api client, utils, export
├── store                  zustand stores
└── types                  shared TypeScript types

src-tauri/src/             backend (Rust)
├── commands/              tauri commands (connection/metadata/query)
├── influx/                FlightSQL client, metadata queries, conn pool
├── storage/               connections.json + keychain + history.jsonl
├── error.rs
└── models.rs
```
