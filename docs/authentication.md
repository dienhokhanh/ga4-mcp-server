# Authentication

`ga4-mcp-server` supports three ways to authenticate. It picks the first one available, in this order:

1. **`GOOGLE_APPLICATION_CREDENTIALS`**: a service account key (or any ADC-compatible JSON file)
2. **Saved browser sign-in**: the token written by `npx ga4-mcp-server auth`
3. **Application Default Credentials (ADC)**: e.g. from `gcloud auth application-default login`

Whichever you choose, you first need a Google Cloud project with both APIs enabled:

- [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)
- [Google Analytics Admin API](https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com)

Scopes: the server requests `analytics.readonly` by default, and `analytics.edit` only when `GA4_MCP_ENABLE_WRITES=true`.

---

## Option 1: Service account (recommended for most users and for teams)

Best for: stable, non-interactive setups; shared/team machines; CI.

1. **Google Cloud Console → IAM & Admin → Service Accounts → Create service account.** No project roles are needed.
2. Open the account → **Keys → Add key → Create new key → JSON**. Save the file somewhere private.
3. **GA4 → Admin → Property access management → +** and add the service account email (`name@project.iam.gserviceaccount.com`) with the **Viewer** role, or **Editor** if you'll enable write tools. You can also grant it at the account level to cover all properties.
4. Point the server at the key:

   ```json
   "env": { "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/key.json" }
   ```

> Some organisations block service account key creation (`iam.disableServiceAccountKeyCreation`). If so, use option 2 or 3.

## Option 2: Browser sign-in with your Google account

Best for: individuals who already have GA4 access with their own account and don't want to manage GA user lists.

1. **Google Cloud Console → APIs & Services → OAuth consent screen**: configure it (User type _External_ is fine for personal use) and add your Google account as a **test user**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Application type: Desktop app.** Download the JSON.
3. Run once:

   ```bash
   npx -y ga4-mcp-server auth --client-secret /path/to/client_secret.json
   # add --enable-writes to request the analytics.edit scope
   # add --no-browser to print the URL instead of opening a browser
   ```

   A browser opens; sign in and approve. The token is saved to:
   - Windows: `%APPDATA%\ga4-mcp-server\token.json`
   - macOS/Linux: `~/.config/ga4-mcp-server/token.json` (or `$XDG_CONFIG_HOME`)

   Override with `GA4_MCP_TOKEN_FILE`.

4. Start your MCP client. No extra `env` is needed, as long as `GOOGLE_APPLICATION_CREDENTIALS` isn't set.

> While the consent screen is in **Testing** mode, Google expires refresh tokens after 7 days. Re-run `auth`, or publish the consent screen to **In production** (you'll see an "unverified app" warning for your own client, which is fine for personal use).

## Option 3: gcloud Application Default Credentials

Best for: people who already use the gcloud CLI.

Google blocks the Analytics scopes for gcloud's built-in OAuth client, so pass your own Desktop OAuth client (see option 2, step 2):

```bash
gcloud auth application-default login \
  --client-id-file=/path/to/client_secret.json \
  --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform

# If you see quota-project warnings:
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

No `env` is needed in your MCP config. The server finds ADC automatically.

---

## Checking which credentials are used

The server logs its auth method to stderr on start-up, e.g.

```
ga4-mcp-server 0.1.0 running on stdio — auth: saved OAuth token (/home/me/.config/ga4-mcp-server/token.json); writes disabled
```

Most clients show server logs (Claude Code: `claude --debug`; Claude Desktop: the `mcp-server-ga4.log` file; VS Code: _MCP: List Servers → Show Output_).
