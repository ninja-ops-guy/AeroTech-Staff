# AeroTech Operations

A runnable local operations interface for RESIDUAL Command Station, using the owner's TechOps Hero artwork and StarNet's station document model. This is the first functional slice of the proposed reskin, not a completed replacement for the StarNet desktop app or every RFS master-spec gate.

## Run

Requires Node.js 20 or later. No npm installation or third-party runtime dependencies are needed.

```sh
cd aerotech
node server.cjs
```

Open the address printed in the terminal. Select **Explore demo** to inspect the explicit, static interface fixtures. Nothing calls a model or modifies RESIDUAL.

Connect to your existing local Command Station:

```sh
node server.cjs --station http://127.0.0.1:8765
```

Use the actual address of your station. AeroTech gets its own free loopback port by default and never stops another server. To specify its port, add `--port 8899`. If that port is occupied, select `--port 0` for automatic allocation. Equivalent environment variables: `AEROTECH_STATION_URL` and `AEROTECH_PORT`.

To enable explicit run, triage, pause and resume requests:

```sh
node server.cjs --station http://127.0.0.1:8765 --control
```

Controls are disabled by default. Each action has a confirmation describing its host behavior. Running a mission can call the host's configured providers, execute permitted tests, and review/integrate through its existing batch policy. A station training mission uses scripted proposals instead. No provider keys need to be copied into AeroTech.

On Windows, double-click `start-aerotech.cmd` for the offline studio or run the command above in PowerShell for a live connection. Keep that terminal open. This is a source-run build; no Windows installer or Tauri package is claimed.

## What works

- AeroTech industrial floor using byte-identical TechOps Hero background, Mike/Waldo/Katrin/Manchez sprite atlases, operator/clerk portraits and workstation props.
- Stable character assignments by worker, a local appearance picker, authored idle/locomotion frames, foot-anchored room transitions and frozen paused/stale/reduced-motion views.
- StarNet's pure station document model supplies the named display zones. The new renderer is adapted to the game's side-view artwork; this is not an indiscriminate texture replacement in StarNet's top-down renderer.
- Missions, host task states, owner/attempt information, base/head identities, checks, findings, task artifact text and event records from the real Command Station API.
- Search, floor/board views, clickable task sprites, evidence dialogs, responsive layout and reduced motion.
- Separate local process, automatic port allocation, session cookie, same-origin checks, local-only upstream endpoint and bounded reads.
- Disconnection retains the last snapshot with a stale indicator. A station demo is labeled separately from a live mission; local preview fixtures are always labeled DEMO.
- Opt-in host run/triage/pause/resume requests with local-session protection, revision preflight and a durable send-once command journal.

## Boundaries

The default is read-only. With `--control`, AeroTech exposes a bounded subset of native host commands. **Open Command Station** provides the host's complete UI. No local scheduler, provider routing, direct model calls, approval authority or acceptance authority is introduced.

Commands are reserved durably before forwarding. Reusing an ID returns the recorded result, and conflicting content is rejected. A crash or ambiguous host reply leaves `OUTCOME_UNKNOWN`; that command is never automatically resent and new commands for that mission are fenced. This is send-once forwarding, not a claim of exactly-once host execution. An acknowledgment with a job ID is not completion. The expected revision is checked immediately before dispatch, but the native host has no atomic compare-and-swap API; host-side validation still controls the actual operation. No direct approval or integration override is offered.

The journal lives in `~/.aerotech-operations/commands` (Windows user home equivalent), or the directory specified by `--data PATH` / `AEROTECH_DATA_DIR`. It contains command identities and outcomes, never provider credentials. If a request is unresolved, inspect the host's jobs/events and retain its journal record; do not clear the journal to blindly retry. Resolution tooling is future work. A stale `dispatch.lock` after a process crash requires confirming no AeroTech dispatch process is active before removing that lock; pending request records continue to fence unresolved work.

The adapter supports the inspected `ResidualStation/0.3` / bootstrap `0.3.0` / `LDD workflow v1` contract. It uses `/api/bootstrap`, `/api/diagnostics`, `/api/projects`, project detail/events and scoped text artifacts, plus native project `run`, `triage` and `pause` routes when controls are enabled. The session token stays in server memory; browser data is restricted to the observer projection and command results.

Snapshots and event history are separate HTTP reads, not an atomic event-sourced snapshot. Events preserve native sequence IDs, which may skip within a project because SQLite sequences span projects. Up to 10,000 records are read per project; the UI displays the latest 40 and reports truncation. Host event hashes and receipts are displayed as recorded, not independently verified. `integrated` remains **Integrated**, not a newly invented **Accepted** state.

The local address is explicitly selected by the operator. Server/version/schema checks detect accidental wrong-service connections but are not cryptographic remote-server authentication. Remote HTTP/LAN endpoints and arbitrary upstream URLs are deliberately unsupported. Don't expose this observer via a tunnel without designing a remote authentication boundary.

No settings or credentials are imported from the existing StarNet app. Existing upstream features and artwork remain in the parent fork checkout, but the standalone AeroTech download/entrypoint serves only the files under its own `public` directory. Upstream updater and desktop processes never start through this entrypoint.

## Verification

```sh
node --test test/*.test.cjs
```

See `qa/crew-verification.json` for the current crew browser checks. `qa/verification.json` and `qa/initial-build-manifest.json` preserve the initial alpha’s historical integration evidence. Future Windows native/Tauri qualification, runtime Hermes execution and full RFS acceptance remain separate work. A deterministic station training mission exercises real local Git/check execution without making model calls.

## Sources and rights

StarNet origin: https://github.com/androoAGI/starnet. The vendored `public/vendor/worldmodel.js` is unchanged from the commit in `ASSET-MANIFEST.json`; its MIT notice is retained in `STARNET-LICENSE.txt`. This product is independently named and is not endorsed by StarNet. No StarNet logo, sprites or station artwork is used by the AeroTech entrypoint.

TechOps Hero origin: https://github.com/ninja-ops-guy/techops-hero. The owner explicitly requested reuse of these game assets. `ASSET-MANIFEST.json` records exact source paths, commit, byte counts and SHA-256 values. No new license over those assets is asserted, and they are not covered by StarNet's MIT notice. Preserve the source game's relevant notices when redistributing more broadly.

RESIDUAL source contract: https://github.com/ninja-ops-guy/residual-agent-harness, pinned in the manifest. Neither reference repository is modified by this build.

## Continuing in the fork

The parent branch is `feat/aerotech-residual`. All application changes are isolated under `aerotech/` plus root npm scripts. Run `npm run aerotech` from the parent checkout or execute the standalone folder directly. The next engineering steps are native host idempotency/atomic revision support, command-outcome reconciliation tooling, an actual Windows package, richer TechOps room art. Keep these separate from RESIDUAL v1 convergence.

## Crew verification

Run `node qa/verify-crew.cjs` with Playwright available (`TEST_PLAYWRIGHT_MODULE` and `TEST_CHROMIUM_PATH` can override its locations). It uses the local demo and presentation fixtures, never a live station. Mike, Waldo, Katrin and Manchez have six idle and six locomotion frames; the operator and clerk are static portraits that translate between stations. Character identities are visual choices, separate from the authoritative worker record.

`BUILD-MANIFEST.json` describes the current app source. Its digest hashes the UTF-8 compact JSON representation of its sorted `files` array. Images are also listed with source provenance in `ASSET-MANIFEST.json`. QA screenshots and result records are excluded from the build digest.
