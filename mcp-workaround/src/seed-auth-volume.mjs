import { readFile } from "node:fs/promises";
import { requireArgument, sessionId, withTenkiMcp } from "./mcp-client.mjs";

const volume = requireArgument("--volume");
const xState = requireArgument("--x-state");
const linkedInState = requireArgument("--linkedin-state");

await withTenkiMcp(async ({ call, scope }) => {
  let id;
  try {
    id = sessionId(
      await call("tenki_create_sandbox", {
        name: "fde-auth-seed",
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        cpu_cores: 1,
        memory_mb: 1024,
        max_duration_seconds: 600,
        idle_timeout_minutes: 5,
      }),
    );
    await call("tenki_attach_volume", { session_id: id, volume_id: volume, mount_path: "/workspace/secrets" });
    await call("tenki_write_file", {
      session_id: id,
      path: "/workspace/secrets/x.storageState.json",
      content: await readFile(xState, "utf8"),
    });
    await call("tenki_write_file", {
      session_id: id,
      path: "/workspace/secrets/linkedin.storageState.json",
      content: await readFile(linkedInState, "utf8"),
    });
    console.log(JSON.stringify({ sessionId: id, volumeId: volume, seeded: ["x.storageState.json", "linkedin.storageState.json"] }, null, 2));
  } finally {
    if (id) await call("tenki_terminate_sandbox", { session_id: id }).catch(() => {});
  }
});
