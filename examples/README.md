# Client configuration examples

| File                   | Client                  | Where it goes                                                     |
| ---------------------- | ----------------------- | ----------------------------------------------------------------- |
| `claude-code.mcp.json` | Claude Code             | `.mcp.json` in your project root (or use `claude mcp add`)        |
| `claude-desktop.json`  | Claude Desktop          | Settings → Developer → Edit Config (`claude_desktop_config.json`) |
| `codex-config.toml`    | OpenAI Codex CLI / IDE  | `~/.codex/config.toml`                                            |
| `vscode-mcp.json`      | VS Code (Copilot agent) | `.vscode/mcp.json` in your workspace                              |
| `cursor-mcp.json`      | Cursor                  | `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project)     |
| `gemini-settings.json` | Gemini CLI              | `~/.gemini/settings.json`                                         |

Using browser sign-in or gcloud ADC instead of a service account? Remove the `GOOGLE_APPLICATION_CREDENTIALS` entry. See [../docs/authentication.md](../docs/authentication.md).

**Windows:** escape backslashes in JSON (`"C:\keys\sa.json"`) or use forward slashes (`"C:/keys/sa.json"`).
