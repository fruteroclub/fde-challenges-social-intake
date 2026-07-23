import { requireArgument, sessionId, withTenkiMcp } from "./mcp-client.mjs";

const requiredEnv = [
  "TENKI_IMAGE",
  "TENKI_AUTH_VOLUME_ID",
  "NEBIUS_API_KEY",
  "NOTION_API_KEY",
  "NOTION_DATABASE_ID",
];
for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}
if (!process.env.X_POST_URL && !process.env.LINKEDIN_POST_URL) {
  throw new Error("Set X_POST_URL, LINKEDIN_POST_URL, or both.");
}

const repository = process.env.FDE_REPOSITORY_URL ?? "https://github.com/fruteroclub/fde-challenges-social-intake.git";
const commit = process.env.FDE_COMMIT_SHA;
const workerEnv = {
  NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  FDE_REPOSITORY_URL: repository,
  FDE_COMMIT_SHA: commit ?? "",
  X_STORAGE_STATE_PATH: "/workspace/secrets/x.storageState.json",
  LINKEDIN_STORAGE_STATE_PATH: "/workspace/secrets/linkedin.storageState.json",
};
if (process.env.X_POST_URL) workerEnv.X_POST_URL = process.env.X_POST_URL;
if (process.env.LINKEDIN_POST_URL) workerEnv.LINKEDIN_POST_URL = process.env.LINKEDIN_POST_URL;

const workerCommand = `
set -euo pipefail
git clone --depth 1 "$FDE_REPOSITORY_URL" /home/tenki/app
cd /home/tenki/app
if [ -n "$FDE_COMMIT_SHA" ]; then
  git fetch --depth 1 origin "$FDE_COMMIT_SHA"
  git checkout "$FDE_COMMIT_SHA"
fi
npm ci
npm run build
node dist/index.js
`;

await withTenkiMcp(async ({ call, scope }) => {
  let id;
  try {
    id = sessionId(
      await call("tenki_create_sandbox", {
        name: "fde-intake-refresh",
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        registry_ref: process.env.TENKI_IMAGE,
        cpu_cores: 2,
        memory_mb: 4096,
        max_duration_seconds: 1800,
        idle_timeout_minutes: 15,
        allow_outbound: true,
        env: workerEnv,
      }),
    );
    await call("tenki_attach_volume", {
      session_id: id,
      volume_id: process.env.TENKI_AUTH_VOLUME_ID,
      mount_path: "/workspace/secrets",
      read_only: true,
    });
    const result = await call("tenki_exec", {
      session_id: id,
      command: "bash",
      args: ["-lc", workerCommand],
      timeout_seconds: 1500,
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (!result.ok) throw new Error(`Worker exited ${result.exitCode}.`);
  } finally {
    if (id) await call("tenki_terminate_sandbox", { session_id: id }).catch(() => {});
  }
});
