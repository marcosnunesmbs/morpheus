# Research: Google Workspace Skills Initialization

## Decision: MD5-based Smart Sync for Skills

**Rationale**: We need to update built-in skills when the codebase changes, but we must not overwrite user customizations. By comparing the MD5 hash of the file in `.morpheus/skills/` against the *current* codebase default, we can detect if they are different. However, to fulfill the requirement "Only overwrite if the file matches a known codebase default", we should ideally maintain a list of hashes for all "official" versions of each skill. If the user's file matches ANY of these hashes, it's an unmodified official version and can be updated to the latest. If it doesn't match, the user has customized it.

**Implementation**:
- Use Node.js `crypto` module to generate MD5 hashes.
- Store a `hashes.json` in `gws-skills/skills/` containing the latest hashes of all files.
- During `scaffold()`, iterate through `gws-skills/skills/` folders.
- If destination doesn't exist: Copy.
- If destination exists:
  - If `user_file_hash == latest_default_hash`: Already up to date.
  - If `user_file_hash == previous_default_hash` (from a local cache or hardcoded list): Update to latest.
  - Else: Preserve (user modification detected).

**Alternatives considered**:
- **Always Overwrite**: Rejected (violates user customization requirement).
- **Never Overwrite**: Rejected (users would never get bug fixes or new tool schemas).

## Decision: `gws` CLI via Service Account

**Rationale**: `gws` CLI supports authentication via `GOOGLE_APPLICATION_CREDENTIALS` environment variable. This is the most standard way for server-side/daemon integrations.

**Implementation**:
- Add `gws` section to `zaion.yaml` with `service_account_json` path.
- In `Apoc` (or the tool executor), when executing a command that starts with `gws`, inject `GOOGLE_APPLICATION_CREDENTIALS` into the environment if the config is present.
- Update `Dockerfile` to install `gws` CLI.

**Binary Installation in Docker**:
```dockerfile
# Download latest gws CLI
RUN wget https://github.com/googleworkspace/cli/releases/latest/download/gws-linux-amd64 -O /usr/local/bin/gws \
    && chmod +x /usr/local/bin/gws
```

## Decision: Integration Point

**Rationale**: `src/runtime/scaffold.ts` is the entry point for environment preparation. Adding `syncSkills()` here ensures skills are ready before Oracle starts.

**Implementation**:
- New function `syncSkills()` called inside `scaffold()`.
- It will handle the directory traversal and MD5 comparisons.
