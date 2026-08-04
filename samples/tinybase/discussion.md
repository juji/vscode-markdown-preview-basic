# TinyBase as the client data layer — discussion, not a plan

**TL;DR:** TinyBase (v9.x, `tinybase` on npm) is a reactive in-memory store with tables/values, React hooks, and drop-in persisters for IndexedDB, OPFS, and SQLite (via `@sqlite.org/sqlite-wasm` — the exact dependency `primssg-db` already bundles). It genuinely covers ~80% of what this client has hand-rolled: the four Zustand stores and the `primssg-db` typed-SQLite layer could collapse into one `createStore()` + one persister, with `ui-react` hooks replacing `useMessagesStore`/`useSessionStore` selectors. But it is *not* a free full replacement: TinyBase cells can't hold binary data (the `keys` BLOBs break), the service worker reads the session straight out of IndexedDB in `idb-keyval`'s format (TinyBase's own IDB format is invisible to it), and the WebSocket/signaling store is event plumbing, not data — "fully use TinyBase" needs a boundary drawn there. This doc maps the current layer onto TinyBase, lays out the persistence fork (IndexedDB vs OPFS vs SQLite persister), and names the real open questions. Nothing here is scoped into an implementation plan.

## What the client uses for data today

- **`session-store.ts`** — the logged-in `User`, hydrated from IndexedDB via `idb-keyval` (`zustand/persist`, key `webrtc-session` in the `keyval-store` DB). Only persisted Zustand store. `hasHydrated` gates the app.
- **`messages-store.ts`** — in-memory `byPeer: Record<string, ChatMessage[]>`, sorted by `createdAt` on every insert (arrival order ≠ message order), with a stable `EMPTY_MESSAGES` ref so selectors don't allocate arrays per render.
- **`signaling-store.ts`** — WebSocket lifecycle (`connect`/`disconnect`/`send`) plus a pub/sub `subscribe()` with a replay buffer of the last 20 inbound messages. The listeners and buffer are module-level, outside the Zustand state entirely.
- **`db-store.ts`** — owns the single `PrimssgDBWasm` instance; every other lib (`keys.ts`, `contacts.ts`, `chats.ts`, `convos.ts`, `settings.ts`) calls `useDbStore.getState().db.<method>()`. The one-connection-per-browser rule (SAHPool access handle + `navigator.locks` in `primssg-db-wasm.ts`) is why this singleton exists.
- **`primssg-db`** — interface `PrimssgDB` + `PrimssgDBWasm` (worker-thread SQLite/OPFS). Tables in `schema.ts`: `keys` (BLOB key material), `contacts`, `conversations`, `messages` (indexed on `(ownerId, threadId)`), `settings` (JSON text). **File blobs are not in SQLite** — P2P-transferred files live as OPFS files under a `file-blobs/` directory (`worker.ts` `getFileBlobsDir`), so they're outside the "which store?" question either way.
- **Dev tooling tied to SQLite**: `dev-panel-sqlite-tab.tsx` runs raw SQL against the live connection; `scripts/query.mjs` drives a headless browser through the `/dev/sqlite` page; `debugQuery()` is the raw-SQL escape hatch. All of it exists because "it's a real SQLite database you can inspect."
- The heaviest consumer is `use-webrtc-chat.ts` (449 lines): reads `byPeer[peer]`, writes `addMessage`/`updateStatus`, and inspects the store imperatively (`getState().byPeer[peer].some(...)`) to dedupe persisted-history loads against live arrivals.

## What TinyBase actually is (verified against the current docs)

- `createStore()` — reactive tables (rows of cells) + keyed values, with listeners at every granularity and `getSortedRowIds` for keyed ordering. Optional `TablesSchema`/`ValuesSchema` for typed, defaulted cells.
- `tinybase/ui-react` — `useCell`, `useRow`, `useRowIds`, `useSortedRowIds`, etc.; a component re-renders only when the subscribed slice changes (solves the `EMPTY_MESSAGES` concern differently — hooks are the stable read path).
- Queries (`TinyQL`, select/join/filter/sort/group), `Metrics`, `Indexes`, `Relationships`, `Checkpoints` (undo), and an `Inspector` component (`tinybase/ui-react-inspector`) for live data inspection/editing.
- Persisters:
  - `createIndexedDbPersister(store, dbName)` — IndexedDB object stores `t`/`v`. Loads via polling (no reactive external-change detection); **does not support `MergeableStore`**.
  - `createOpfsPersister(store, handle)` — one JSON-serialized store in a single OPFS file; supports `MergeableStore`.
  - `createSqliteWasmPersister(store, sqlite3, db, config?)` — SQLite via `@sqlite.org/sqlite-wasm`, in either whole-store-JSON (default) or `tabular` (one SQL table per TinyBase table) mode. Same WASM package `primssg-db` already ships.
  - (`createLocalPersister`/`createSessionPersister` for storage/sessionStorage; non-web: `persister-sqlite3`, `persister-sqlite-bun`.)
- Bundle: ~7.2 kB store / ~15.6 kB full / ~5.9 kB `ui-react` (gzip), zero dependencies.
- **`Cell` = `string | number | boolean | null | AnyObject | AnyArray` — no `Uint8Array`/binary.** Verified on the `Cell` type-alias page. This is the load-bearing constraint below.

## The mapping, piece by piece

- **`db-store.ts` + `primssg-db` → one `createStore()`.** The five SQLite tables become TinyBase tables (row id in parens):
  - `keys` (id) → cells for the four key parts — but see "binary" below.
  - `contacts` (ownerId+id) → two cells (`ownerId`, `id`) plus the rest.
  - `conversations` (ownerId+contactId), `messages` (ownerId+messageId), `settings` (id).
  - Per-owner/per-thread reads (`listMessages(ownerId, threadId)`, `listConversations(ownerId)`) become `Indexes` on the owning cells + `getSortedRowIds`/`Queries`. `unreadCount`/`lastMessage` aggregate reads become `Metrics` or a `Query`.
  - The `PrimssgDBWasm` main-thread facade and its request/response protocol disappear; the sqlite worker + SAHPool + Web-Lock machinery survives in whatever owns the `sqlite3` instance the persister is handed (`createSqliteWasmPersister` takes the module and `db` handle — it doesn't create them). That deletes the package's typed-method layer and protocol, not the SQLite plumbing underneath.
- **`messages-store.ts` → the `messages` table + hooks.** `addMessage`/`updateStatus` become `setRow`/`setCell`; reads become `useSortedRowIds('messages', 'createdAt')` filtered by thread, or a parameterized `Query`. The dedupe checks in `use-webrtc-chat.ts` (`getState().byPeer[peer]?.some(...)`) become `store.getRow('messages', messageId)` — same shape, one lookup instead of a scan.
- **`session-store.ts` → a `value` (or a one-row table) in the same store.** `hasHydrated` becomes "persister `load()` finished." The service-worker constraint is the catch — see below.
- **`signaling-store.ts` → stays.** WebSocket state, the send queue, and the replay buffer are event plumbing with a synchronous call/return contract (`send`, `subscribe` returning an unsubscribe). TinyBase has no notion of "in-flight message" or subscriptions with replay. The only data-shaped bit is `connected` — that *could* be a store value so the UI reacts to it, but the WS itself and the listener set aren't TinyBase's job. Drawing this boundary is the honest meaning of "fully."

## The persistence fork — the real decision

Only one persister per store. The three candidates differ in what they cost:

**A. `createIndexedDbPersister` — simplest, most complete replacement.** One persister, one new module, nothing SQL left in the app. Costs:
- **sw.js breaks.** It reads `webrtc-session` from `keyval-store`/`keyval` (`public/sw.js`) to know the logged-in user for push-subscription rotation. TinyBase writes its own `dbName` DB in `t`/`v` object stores — sw.js can't read that format without reimplementing it. Fix (precedented): keep a thin `idb-keyval` mirror for the session only, exactly like `settings-mirror.ts` already does for settings/focus. The store stays the source of truth; a small effect writes the mirror.
- **Raw-SQL dev tooling dies.** `dev-panel-sqlite-tab`, `/dev/sqlite`, `scripts/query.mjs` have nothing to query. TinyBase's `Inspector` replaces the *value* (live, editable data view) — but `query.mjs`'s terminal story doesn't transfer; you'd inspect via the browser inspector or a debug route.
- **Migration.** Existing OPFS SQLite data must be exported into the TinyBase tables once (a one-time script that reads through the current worker and writes to the store). Same for every path that abandons the SQLite file.

**B. `createSqliteWasmPersister` — keep SQLite.** Reuses the exact `@sqlite.org/sqlite-wasm` dep, keeps the existing OPFS file (no export/import — at worst a data lift inside the same file), and `query.mjs`/`/dev/sqlite` keep working because the data is still inspectable SQL. Two modes:
- **JSON** (default): the whole store serialized into one row of a table (e.g. `tinybase`) in the same SQLite file. Coexists cleanly with the legacy `schema.ts` tables for a one-time data lift, then they're dropped. Keys ride along as base64 strings inside the JSON — no BLOB side-storage needed.
- **`tabular`**: one SQL table per TinyBase table, dense (every row has every cell), columns derived from cell ids — so it writes its own shape and can't adopt the existing `schema.ts` column layouts as-is.
- Either way the "no raw SQL in app code" convention survives only because the persister, not app code, writes SQL, and the SAHPool single-connection constraint (why `db-store` is a singleton today) still governs the file — TinyBase inherits the multi-tab question, it doesn't remove it.

**C. `createOpfsPersister` — one JSON file in OPFS.** Interesting because the app is already OPFS-native and it's the only browser option that supports `MergeableStore` (relevant to the encryption discussion's decided-but-deferred multi-device sync). But it's a whole-store JSON snapshot in one file: every save rewrites all message history, and the single-connection caveat of B still applies at the file level.

**Recommended: B (sqlite-wasm persister).** It's the only fork where the app's existing invariants survive intact: the OPFS SQLite file stays put, the raw-SQL dev tooling keeps working, the SAHPool/Web-Lock single-connection model doesn't change, and there's no export/import of user data. The binary-keys friction is identical on every fork (base64 either way), so it isn't a point against B. The tradeoff is owning a real SQLite dependency for the store's sake, and `primssg-db`'s typed-method layer is what actually gets deleted — SQLite survives, the package's interface doesn't. A (IndexedDB) is the fallback if the goal ever becomes "no SQLite at all"; C stays the answer if multi-device CRDT sync becomes real.

## The awkward corners (each one has a workable answer)

- **Binary keys.** `KeyBundle` is four `Uint8Array`s stored as SQLite BLOBs (`schema.ts`). TinyBase cells can't hold `Uint8Array`. Encoding as base64/hex strings is native now (`Uint8Array.fromHex`/`.toBase64()` are baseline in the MDN docs) — `loadKeys`/`storeKeys` (`client/lib/keys.ts`) encode/decode at the boundary. Keys stay device-local either way: the same OPFS SQLite file, base64 in a cell instead of a BLOB column. Nothing about `plans/encryption`'s "secret keys never leave the device" is weakened by the move.
- **File blobs.** Already OPFS files, not SQLite — unaffected by the store choice. TinyBase never sees them.
- **Service-worker session read.** Applies to every fork: once the session lives inside the TinyBase store (SQLite row or IndexedDB), `sw.js`'s raw `keyval-store` read of `webrtc-session` can't see it. The `settings-mirror.ts` pattern is the template — the store stays the source of truth, a thin effect mirrors `user` to idb-keyval for sw.js.
- **signaling-store.** Stays a plain module. `connected` could be promoted to a store value if a reactive connection indicator is wanted; the WS pub/sub doesn't move.
- **Existing local data.** With SQLite kept (B), there's no export/import: the same OPFS file stays open, and existing rows lift into the TinyBase tables inside it — mechanical, cell-for-cell, and the `file-blobs/` directory is untouched either way.
- **Multi-tab.** Today Web Locks + SAHPool allow exactly one connection, and that constraint persists on B (the same file). The IndexedDB persister (A) would actually be *less* strict — single-writer-with-polling, two tabs last-write-wins — but the WebRTC stack is single-connection-shaped anyway, so neither is a regression.
- **Dev panel.** Under B, `dev-panel-sqlite-tab.tsx` keeps working unchanged (same live SQLite). The `Inspector` (`tinybase/ui-react-inspector`) is an addition, not a replacement: a live, editable view of the store's tables on top of the same data.

## Open questions

**1. Does the session stay in the same store as message data?** Putting `user` in the shared store means one persister, one load gate, and the idb-keyval mirror only for sw.js. Keeping it separate (its own store/persister) preserves today's isolation but adds a second store for no security gain — both are plaintext browser storage. Leaning shared, not decided.

**2. What exactly is `primssg-db`'s fate?** SQLite stays, but the package itself — the `PrimssgDB` interface, the worker protocol, the typed methods — is what TinyBase replaces. The one thing that doesn't transfer is its original *raison d'être*: a shared schema/query layer for a future Tauri desktop build. TinyBase has non-web persisters (`persister-sqlite3`/`persister-sqlite-bun`) for that, so the Tauri story survives in a different form, but it's a real rationale being abandoned — worth an explicit sign-off.

**3. Adopt the existing SQLite file's data or greenfield the TinyBase tables?** With the file kept, the legacy `schema.ts` rows can be lifted in place (mechanical), but there's also a case for a fresh start if the app is pre-release and nobody has real data worth preserving.

## Status

Nothing above is scoped into an implementation plan. This is a survey of how TinyBase maps onto the current client data layer and where the seams are, for whenever this gets picked up.
