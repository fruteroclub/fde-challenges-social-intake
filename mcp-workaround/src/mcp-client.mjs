import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function firstProject(identity) {
  const workspaces = Array.isArray(identity.workspaces) ? identity.workspaces : [];
  const workspace = workspaces.find((candidate) => Array.isArray(candidate?.projects) && candidate.projects.length > 0);
  const project = workspace?.projects?.[0];
  const workspaceId = workspace?.workspaceId ?? workspace?.id;
  const projectId = project?.projectId ?? project?.id;

  if (!workspaceId || !projectId) {
    throw new Error("WhoAmI did not return a workspace with a project for this API key.");
  }

  return { workspaceId, projectId };
}

function parseResult(result, tool) {
  const text = result.content?.find((item) => item.type === "text")?.text ?? "";
  if (result.isError) throw new Error(`${tool}: ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function withTenkiMcp(run) {
  const server = required("TENKI_MCP_SERVER");
  const apiKey = required("TENKI_API_KEY");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    // The MCP server only needs Tenki credentials. Do not hand it the worker's
    // Nebius, Notion, or social-session secrets from the parent process.
    env: {
      TENKI_API_KEY: apiKey,
      ...(process.env.TENKI_API_ENDPOINT ? { TENKI_API_ENDPOINT: process.env.TENKI_API_ENDPOINT } : {}),
    },
  });
  const client = new Client({ name: "fde-challenges-mcp-workaround", version: "0.1.0" });
  await client.connect(transport);

  const call = async (tool, args = {}) => {
    const result = await client.callTool({ name: tool, arguments: args }, CallToolResultSchema, {
      timeout: DEFAULT_TIMEOUT_MS,
    });
    return parseResult(result, tool);
  };

  try {
    const identity = await call("tenki_whoami");
    return await run({ call, identity, scope: firstProject(identity) });
  } finally {
    await client.close().catch(() => {});
  }
}

export function sessionId(result) {
  const id = result.session?.id ?? result.session?.sessionId ?? result.sessionId ?? result.id;
  if (!id) throw new Error(`Tenki did not return a session ID: ${JSON.stringify(result).slice(0, 500)}`);
  return id;
}

export function volumeId(result) {
  const id = result.volume?.id ?? result.volume?.volumeId ?? result.volumeId ?? result.id;
  if (!id) throw new Error(`Tenki did not return a volume ID: ${JSON.stringify(result).slice(0, 500)}`);
  return id;
}

export function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export function requireArgument(name) {
  const value = argument(name);
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}
