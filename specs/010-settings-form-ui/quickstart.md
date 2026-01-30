# Quickstart: Managing Settings

## Accessing the UI
1. Start Morpheus in dev mode: `npm run dev` (or `morpheus start` in production).
2. Open `http://localhost:3333` (or configured port).
3. Click "Settings" in the main navigation (if exists) or go to `/settings`.

## Usage
1. **View**: Tabs arrange settings by category (General, LLM, Channels, etc.).
2. **Edit**: Modify fields as needed. Invalid inputs (like negative temperature) will show an error immediately.
3. **Save**: Click "Save Changes" at the bottom/top. A success toast will confirm persistence.

## Troubleshooting
- **Save Failed**: Check server logs. Ensure `config.yaml` is writable.
- **API Error**: If the API returns validation errors, they will be displayed below the relevant fields.
