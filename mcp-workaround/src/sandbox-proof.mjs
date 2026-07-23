import { sessionId, withTenkiMcp } from "./mcp-client.mjs";

await withTenkiMcp(async ({ call, identity, scope }) => {
  console.log(JSON.stringify({ workspaceId: scope.workspaceId, projectId: scope.projectId }, null, 2));

  let id;
  try {
    id = sessionId(
      await call("tenki_create_sandbox", {
        name: "fde-mcp-proof",
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        cpu_cores: 1,
        memory_mb: 1024,
        max_duration_seconds: 600,
        idle_timeout_minutes: 5,
        allow_outbound: true,
      }),
    );
    const kernel = await call("tenki_exec", { session_id: id, command: "uname", args: ["-a"] });
    const user = await call("tenki_exec", { session_id: id, command: "whoami" });
    console.log(JSON.stringify({ sessionId: id, kernel: kernel.stdout, user: user.stdout }, null, 2));
  } finally {
    if (id) await call("tenki_terminate_sandbox", { session_id: id }).catch(() => {});
  }
});
