import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import open from "open";

interface ClientSecretFile {
  installed?: { client_id: string; client_secret: string };
  web?: { client_id: string; client_secret: string };
}

export interface AuthFlowOptions {
  clientSecretFile: string;
  tokenFile: string;
  scopes: string[];
  openBrowser?: boolean;
  timeoutMs?: number;
}

export function readClientSecret(file: string): { clientId: string; clientSecret: string } {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ClientSecretFile;
  const entry = parsed.installed ?? parsed.web;
  if (!entry?.client_id || !entry.client_secret) {
    throw new Error(
      `${file} is not an OAuth client secret file. Download one from Google Cloud Console → APIs & Services → Credentials → OAuth client ID (type "Desktop app").`,
    );
  }
  return { clientId: entry.client_id, clientSecret: entry.client_secret };
}

/**
 * Run the OAuth "installed app" loopback flow: open the browser, receive the code on
 * 127.0.0.1, exchange it (with PKCE) and save an `authorized_user` credentials file.
 */
export async function runAuthFlow(opts: AuthFlowOptions): Promise<string> {
  const { clientId, clientSecret } = readClientSecret(opts.clientSecretFile);

  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: opts.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });

  const codePromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for the browser sign-in.")),
      opts.timeoutMs ?? 5 * 60_000,
    );
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (!code && !error) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(code ? "ga4-mcp-server is authorized. You can close this tab." : `Authorization failed: ${error}`);
      clearTimeout(timer);
      if (code) resolve(code);
      else reject(new Error(`Authorization failed: ${error}`));
    });
  });

  console.error(
    `\nOpen this URL to sign in with the Google account that can access your GA4 properties:\n\n${authUrl}\n`,
  );
  if (opts.openBrowser !== false) {
    open(authUrl).catch(() => {
      /* URL is printed above; the user can open it manually. */
    });
  }

  try {
    const code = await codePromise;
    const { tokens } = await client.getToken({ code, codeVerifier });
    if (!tokens.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Remove the app's access at https://myaccount.google.com/permissions and run `auth` again.",
      );
    }
    const credentials = {
      type: "authorized_user",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
    };
    fs.mkdirSync(path.dirname(opts.tokenFile), { recursive: true });
    fs.writeFileSync(opts.tokenFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    return opts.tokenFile;
  } finally {
    server.close();
  }
}
