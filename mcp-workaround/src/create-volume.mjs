import { argument, volumeId, withTenkiMcp } from "./mcp-client.mjs";

const name = argument("--name") ?? "fde-auth-state";
const sizeBytes = Number(argument("--size-bytes") ?? 1_073_741_824);
if (!Number.isInteger(sizeBytes) || sizeBytes < 1_048_576) throw new Error("--size-bytes must be an integer of at least 1048576.");

await withTenkiMcp(async ({ call, scope }) => {
  const id = volumeId(
    await call("tenki_create_volume", {
      name,
      size_bytes: sizeBytes,
      workspace_id: scope.workspaceId,
      project_id: scope.projectId,
    }),
  );
  console.log(JSON.stringify({ volumeId: id, name, sizeBytes }, null, 2));
});
