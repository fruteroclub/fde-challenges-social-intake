import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireArgument, sessionId, withTenkiMcp } from "./mcp-client.mjs";

const reference = requireArgument("--image");
const setupScript = await readFile(resolve("..", "template", "setup-script.sh"), "utf8");

await withTenkiMcp(async ({ call, scope }) => {
  let id;
  try {
    id = sessionId(
      await call("tenki_create_sandbox", {
        name: "fde-intake-image-builder",
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        cpu_cores: 2,
        memory_mb: 4096,
        disk_size_gb: 10,
        max_duration_seconds: 3600,
        idle_timeout_minutes: 15,
        allow_outbound: true,
      }),
    );

    const provision = await call("tenki_exec", {
      session_id: id,
      command: "bash",
      args: ["-lc", setupScript],
      timeout_seconds: 1800,
    });
    if (!provision.ok) throw new Error(`Playwright provisioning failed: ${provision.stderr || provision.stdout}`);

    await call("tenki_publish_image", {
      reference,
      source_session_id: id,
      visibility: "private",
      metadata: "FDE Challenges worker image, provisioned via the temporary tenki-mcp workaround.",
    });
    console.log(JSON.stringify({ image: reference, sourceSessionId: id }, null, 2));
  } finally {
    if (id) await call("tenki_terminate_sandbox", { session_id: id }).catch(() => {});
  }
});
