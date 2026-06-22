# sshx Next Evolution

Comprehensive analysis of the sshx project — what it does well, what's missing, and the roadmap for the next major version.

---

## What the Project Does Well

- **Clean architecture**: Three-layer split (`sshx-core`, `sshx`, `sshx-server`), well-factored Rust workspace
- **Real E2E encryption**: AES-128-CTR + Argon2id KDF, key never leaves clients, server is zero-trust
- **Elegant protocol multiplexing**: gRPC (CLI ↔ server) + Axum HTTP/WS (browser ↔ server) on one port via `tower::Steer`
- **CBOR over WebSocket**: Compact binary format, more efficient than JSON
- **Predictive local echo**: Typeahead addon ported from VS Code, hides latency
- **Redis-backed multi-server mesh**: Session snapshots with zstd compression, transparent WebSocket proxying
- **Polished web frontend**: xterm.js with WebGL, infinite canvas, multi-terminal windows, live cursors, chat
- **Constant-time auth checks**: No timing side-channels on encrypted_zeros or write password verification
- **Cross-platform PTY**: Unix (nix) + Windows (conpty) terminal support

---

## What's Missing

### Production Readiness

| Gap | Impact |
|-----|--------|
| No CI/CD pipeline | No automated builds, tests, or deployments |
| No test suite (0 integration tests) | Cannot safely refactor or accept contributions |
| No self-hosted docs/tooling | Community cannot run their own instances |
| No rate limiting or resource controls | Vulnerable to resource exhaustion |
| No metrics or structured logging | No observability in production |
| Redis is hard dependency for multi-node | No graceful fallback |

### Features

| Gap | Impact |
|-----|--------|
| No file transfer | Users email scripts instead of using sshx |
| No session recording/playback | Can't review or share past sessions |
| No clipboard sync between users | Manual copy-paste across terminals |
| No session discovery or listing | Must know exact URL |
| No mobile-responsive UI | Broken on phones/tablets |
| No authentication system | Anyone with the URL can join |
| No origin validation on WS | Potential CSWSH risk |

### Tech Debt

| Issue | Impact |
|-------|--------|
| Svelte 3 / SvelteKit 1 (outdated) | Missing Svelte 5 runes, slower builds |
| Vite 4 (outdated) | Missing Vite 6 improvements |
| ~2000-line typeahead.ts from VS Code | Uses private xterm.js APIs, fragile |
| No shared test vectors between Rust and TS encrypt | Easy to break sync silently |
| `ciborium` CBOR lib (slower than alternatives) | Message parsing bottleneck |

---

## Next Evolution: 10 Priority Features

### P0 — Critical Foundations

#### 1. CI/CD + Automated Tests

Add GitHub Actions workflows:

- `cargo build && cargo test` on every push/PR
- `npm run check && npm run lint` for frontend
- Cross-compilation matrix (all 10 targets from `scripts/release.sh`)
- Docker image build + push to registry
- Integration test: spawn server → connect WebSocket → authenticate → verify shell creation
- **Shared test vectors** for encryption: Rust `encrypt.rs` and TypeScript `encrypt.ts` must produce identical `zeros()` output

#### 2. Self-Hosted Deployment

- Production `docker-compose.yml` with sshx + Redis
- Helm chart for Kubernetes
- Reverse proxy docs (nginx/Caddy with TLS, gRPC passthrough)
- Configurable session expiry, storage limits, mesh settings via env vars
- Graceful fallback when Redis is not configured (local-only mode)

#### 3. Rate Limiting & Resource Controls

- Per-IP rate limiting on WebSocket upgrades
- Max sessions, shells per session, concurrent connections
- Configurable max message sizes for WS and gRPC

---

### P1 — High User Value

#### 4. Session Recording & Playback

- Record terminal output locally (encrypted, stored in IndexedDB or file)
- Replay viewer with scrubbing and speed control
- Useful for debugging, teaching, async review

#### 5. File Transfer (Drag-and-Drop)

- Drag files from browser → terminal (E2E encrypted)
- CLI companion: `sshx push <file>`, `sshx pull <file>`
- Server stores encrypted chunks with TTL, streams to receiver

#### 6. Collaborative Shell Sharing

- Pair programming mode: multiple users typing in the same shell
- Visual indicators: who's typing, cursor states (idle/typing/selecting)
- Per-shell permissions per user

---

### P2 — Important Improvements

#### 7. Frontend Modernization

- Upgrade to **Svelte 5** (runes mode) and **SvelteKit 2**
- Upgrade to **Vite 6**
- Replace `ciborium` with `minicbor` (faster CBOR)
- Replace 2000-line `typeahead.ts` with simpler maintained alternative
- Make session view responsive for mobile (adaptive canvas, touch controls)

#### 8. Observability

- `/health` endpoint (pings Redis, returns 200)
- Prometheus metrics: active sessions, WS connections, throughput, latency
- Structured JSON logging via `tracing-subscriber`
- `RUST_LOG`-based dynamic logging controls

#### 9. Read-Only Mode & Access Control

- "Request edit access" (like Google Docs)
- Optional session passwords (view + write)
- IP allowlist for session access
- Session owner concept with kick/close privileges

#### 10. Terminal Export & Session Metadata

- Export terminal output as plain text or HTML (ANSI colors preserved)
- Session titles, descriptions, tags
- Shareable session "snapshots" (a single frame of terminal state)

---

## Priority Matrix

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 1 | CI/CD + tests | Large | **Critical** |
| 2 | Self-hosted deployment | Medium | **Critical** |
| 3 | Rate limiting | Small | **Critical** |
| 4 | Session recording | Large | High |
| 5 | File transfer | Large | High |
| 6 | Shell sharing | Medium | High |
| 7 | Frontend modernization | Medium | Medium |
| 8 | Observability | Medium | Medium |
| 9 | Access control | Small | Medium |
| 10 | Export + metadata | Small | Medium |

---

## Technical Challenges

1. **E2E encryption vs server-side features**: Recording, search, or content inspection are impossible by design. Solutions: client-side recording, optional unencrypted mode, or double-wrapping with an escrow key.

2. **Mesh networking complexity**: Redis pub/sub has no guaranteed delivery. Session transfers can be lost. Snapshot consistency is best-effort (up to 20s stale). Solution: shorter sync intervals, sequence numbers, client-side gap detection.

3. **Protocol backward compatibility**: Protobuf changes must be managed carefully. Use field reservations, maintain backward-compatible server, add protocol version negotiation.

4. **Cross-platform terminal parity**: Unix PTY (nix) vs Windows conpty have different capabilities. Signal handling, shell detection, UTF-8 edge cases differ. Requires CI matrix on all platforms.

5. **xterm.js scaling**: Each terminal costs ~10-50 MB. For many shells, memory grows quickly. Solution: virtualize off-screen terminals, limit max shells.
