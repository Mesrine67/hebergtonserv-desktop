# Self-hosted Windows runner: Git Bash and security scanner

The GitHub-managed **Code scanning AI findings** job on issue #72 uses an internal setup step that invokes `bash`. On Windows, `C:\Windows\System32\bash.exe` starts WSL, which cannot execute a native Windows `RUNNER_TEMP` script. The subsequent internal `ghcca-node` executable is then absent. This happens before the security scan can inspect source code.

## Fix the dedicated HébergTonServ runner

Ensure `C:\Program Files\Git\bin` precedes `C:\Windows\System32` **only in the runner launch environment**, not globally. For a runner started via `C:\actions-runner\run.cmd`, insert immediately after `@echo off`:

```cmd
rem Prefer Git Bash over WSL bash.exe for GitHub Actions bash steps
SET "PATH=C:\Program Files\Git\bin;%PATH%"
```

Keep a backup of `run.cmd`, and restart the runner only after its active worker finishes. Verify the job receives Git Bash and not WSL Bash. The runner can be auto-updated; preserve/check this configuration after runner upgrades.

## Acceptance checks

1. A new PR triggers the separate `Code scanning AI findings` workflow.
2. It completes its Node setup and runs an actual source scan; it must **not** merely be skipped.
3. Standard frontend/Rust CI also succeeds.
4. Leave issue #72 open until a scan completes successfully. Do not disable scanning, mark failures optional, or insert a placeholder `node.exe` in `ghcca-node`.

The managed scan is a separate GitHub Copilot/Advanced Security workflow, not the repository's ordinary CI workflow.
