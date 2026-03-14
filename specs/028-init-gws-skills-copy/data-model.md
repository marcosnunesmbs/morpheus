# Data Model: Google Workspace Integration

## Config Entities

### `GwsConfig`

Represents the configuration for Google Workspace CLI integration.

- **`service_account_json`** (string, optional): Path to the Google Service Account JSON key file.
- **`enabled`** (boolean, default: true): Whether GWS skills should be automatically initialized.

### `SkillSyncMetadata`

An internal JSON file stored in `.morpheus/skills/.hashes.json` to track the state of installed skills.

- **`skills`** (Map<string, string>): Map of skill name to MD5 hash of the installed version.
- **`last_sync`** (ISO Date): Last time the sync process ran.

## State Transitions

1. **Not Installed**: Skill exists in `gws-skills/skills/` but not in `.morpheus/skills/`.
   - Action: Copy file + update metadata.
2. **Unmodified Default**: Skill exists in both, and the hash in `.morpheus/skills/` matches the known "official" hash from the codebase.
   - Action: Overwrite with latest version if hashes differ + update metadata.
3. **User Customized**: Skill exists in both, but the hash in `.morpheus/skills/` does NOT match ANY known official hashes.
   - Action: Preserve file (do not overwrite) + update metadata (mark as customized).
