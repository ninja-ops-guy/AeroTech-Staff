# AeroTech Staff implementation status

Initial import: 2026-09-30, this repository contains a runnable local alpha imported from development commit `6f94d9cb181f31ec0e28dfe4263c5dfb43f34773`. The initial import was byte-identical. The October 3 crew update modifies the renderer and local UI; original integration evidence is retained separately.

## Decisions after master spec R0

The owner selected **AeroTech** branding and reuse of **TechOps Hero** game assets. This supersedes the provisional Factory Studio name and the requirement to create entirely new artwork where owner-provided artwork is used. The first renderer is a side-view industrial floor suited to those assets, using StarNet's pure station document model. It is not the entire StarNet top-down or desktop application.

The inspected RESIDUAL implementation exposes `ResidualStation/0.3`, bootstrap `0.3.0` and `LDD workflow v1`. Source revisions and artwork identities are pinned in `aerotech/ASSET-MANIFEST.json`. The adapter maps the actual native API rather than implementing speculative R0 endpoints.

## Implemented and verified

- Separate local server with automatic free-port allocation, isolated command data and no provider credentials in the browser.
- TechOps artwork, responsive floor and board, task search, status-bound sprite animation, task evidence and event inspection.
- Explicit demo preview, station-demo labels and retained stale state on disconnection.
- Native project/task/event/artifact reads and opt-in confirmed run/triage/pause/resume requests.
- Durable send-once reservations, request deduplication, revision preflight and fencing after ambiguous outcomes.
- Ten focused tests and recorded desktop/mobile browser checks against a real RESIDUAL training mission, including native local Git/check/review/integration execution without live model calls.

The verification record applies to the source manifest it names. Root packaging and planning documents are outside that original manifest. Do not rewrite the original record to imply that later changes inherited its qualification.

## Remaining work

R0 qualification gates are not declared passed by this import. In particular, host-side atomic revision checks and idempotency, unknown-outcome reconciliation, independently verified receipts, live Hermes qualification, richer room selection and a Windows desktop package remain future work. A native `integrated` task is displayed as Integrated; it is not promoted to an invented Accepted state.

## Parallel Hermes continuation

Use the original master spec's H0 coordinator and A-E work assignments, with these repository boundaries:

| Lane | Primary ownership | First continuation target |
| --- | --- | --- |
| H0 coordinator | `docs/`, root packaging and integration | Pin the candidate, assign isolated branches/worktrees and keep qualification claims current |
| A runtime | Separately scoped RESIDUAL change | Propose native atomic revision/idempotency semantics; do not modify accepted runtime releases implicitly |
| B bridge | `aerotech/lib/`, `aerotech/server.cjs` | Reconcile unknown command outcomes against authoritative host records |
| C UI | `aerotech/public/` except assets and vendor | Improve operator recovery UX and evidence freshness without inventing host state |
| D assets | `aerotech/public/assets/`, asset manifest | Add game character/room mappings; coordinate renderer changes with C |
| E verification | `aerotech/test/`, `aerotech/qa/` | Qualify each new candidate and record explicit remaining gaps |

Keep the vendored model and source attribution intact. Changes to shared contracts, manifests or another lane's files go through H0. Use isolated branches/worktrees for simultaneous edits, then integrate and verify a single pinned candidate. See R0 for detailed dispatch prompts and acceptance cases; reconcile its proposed contracts with the verified native API before implementation.

## October 3 crew update

Six TechOps characters now have stable worker-based appearance assignments and a local picker. Mike, Waldo, Katrin and Manchez use authored idle and locomotion frames; operator/clerk assets are static. Foot anchors use the source atlas metadata (or measured PNG alpha bounds for static staff). Motion is elapsed-time based, freezes for stale/paused missions and respects reduced motion. Visible slots cap at four per room with overflow retained in the task list. Mobile canvas bounds now stay within the floor column.

Six added tests plus the ten adapter tests pass. The separate crew browser receipt covers desktop/mobile, character persistence, canvas selection, locomotion, frozen states and crowded rooms. It does not requalify live RESIDUAL integration. The original build manifest is retained at `aerotech/qa/initial-build-manifest.json`; the current manifest is `aerotech/BUILD-MANIFEST.json`.
