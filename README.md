# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Build-time Environment Variables

These are read at runtime via `dotenvy` (loaded at app startup) or from the OS environment.

### Google Drive Backup (optional)

Required for the in-app "Connect Google Drive" button to work. Without these, the
flow returns a clear error and backups continue to local folder only.

- `GOOGLE_OAUTH_CLIENT_ID` — OAuth client ID from your Google Cloud Console project.
- `GOOGLE_OAUTH_CLIENT_SECRET` — OAuth client secret for the same client.

The OAuth client must be a **Web application** type with this exact redirect URI:
`http://localhost:57432/callback`

Scope required: `https://www.googleapis.com/auth/drive.file`

Create the credentials at <https://console.cloud.google.com/apis/credentials>.

Set them before building:

```bash
export GOOGLE_OAUTH_CLIENT_ID="xxxxx.apps.googleusercontent.com"
export GOOGLE_OAUTH_CLIENT_SECRET="GOCSPX-xxxxx"
npm run tauri dev   # or: npm run tauri build
```
