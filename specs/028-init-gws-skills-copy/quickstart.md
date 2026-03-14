# Quickstart: Google Workspace Integration

Follow these steps to enable and use Google Workspace skills in Morpheus.

## 1. Obtain a Google Service Account Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the APIs you want to use (e.g., Google Sheets, Google Calendar, Google Drive).
4. Go to **IAM & Admin > Service Accounts**.
5. Create a new Service Account.
6. Under **Keys**, create a new JSON key.
7. Download the JSON key file to your machine (e.g., `C:\Users\name\.morpheus\gws-key.json` or `/home/user/.morpheus/gws-key.json`).

## 2. Configure Morpheus

Add the `gws` section to your `~/.morpheus/zaion.yaml`:

```yaml
gws:
  enabled: true
  service_account_json: /home/user/.morpheus/gws-key.json
```

Alternatively, use an environment variable:

```bash
MORPHEUS_GWS_SERVICE_ACCOUNT_JSON=/path/to/key.json
```

## 3. Verify Initialization

Restart Morpheus:

```bash
npx morpheus start
```

You should see logs indicating skills being initialized:
`🔧 Google Workspace skills initialized: 15 new, 0 updated`

If you are running in Docker, the `gws` CLI is already pre-installed. For host installations, ensure `gws` is in your PATH.

## 4. Usage

Ask Oracle to perform a Google Workspace task:
- "Create a new Google Sheet named 'Project Roadmap'"
- "List my unread Gmail messages"
- "Schedule a meeting for tomorrow at 10 AM with Bob"
- "Upload the file 'specs/spec.md' to my Google Drive"

Morpheus will automatically inject the `GOOGLE_APPLICATION_CREDENTIALS` environment variable when executing these tasks.
