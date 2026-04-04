import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import WebSocket from 'ws';

// Constants
const API_BASE = 'http://127.0.0.1:3100/api';
const COMPANY_ID = 'cdbd0cff-7755-4916-9ab2-064f3d47adb6';
const CEO_AGENT_ID = 'c42d973a-7941-4396-9fa9-18e2bbfcbc22';
const PROJECT_ID = '288c12dc-4aca-415a-8d90-137109af18d6';
const WS_URL = `ws://127.0.0.1:3100/api/companies/${COMPANY_ID}/events/ws`;

// Helper: make API requests
async function api(path: string, options?: RequestInit): Promise<any> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// Tool: delegate
async function handleDelegate(args: Record<string, unknown>): Promise<string> {
  const message = String(args.message ?? '');
  const priority = String(args.priority ?? 'medium');

  let title = message;
  let description = '';

  if (message.length > 80) {
    // Try first sentence
    const sentenceEnd = message.search(/[.!?]\s/);
    if (sentenceEnd > 0 && sentenceEnd <= 120) {
      title = message.substring(0, sentenceEnd + 1);
    } else {
      title = message.substring(0, 80);
    }
    description = message;
  }

  const issue = await api(`/companies/${COMPANY_ID}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      status: 'todo',
      priority,
      assigneeAgentId: CEO_AGENT_ID,
      projectId: PROJECT_ID,
    }),
  });

  return `Delegated to CEO agent.\n  Issue: ${issue.identifier ?? 'N/A'}\n  ID: ${issue.id}\n  Title: ${issue.title}\n  Priority: ${priority}`;
}

// Tool: status
async function handleStatus(args: Record<string, unknown>): Promise<string> {
  const issueId = args.issueId as string | undefined;

  if (issueId) {
    const [issue, comments, subtasks] = await Promise.all([
      api(`/issues/${issueId}`),
      api(`/issues/${issueId}/comments`).catch(() => []),
      api(`/companies/${COMPANY_ID}/issues?parentId=${issueId}`).catch(() => []),
    ]);

    const commentList = Array.isArray(comments) ? comments : (comments?.comments ?? comments?.data ?? []);
    const subtaskList = Array.isArray(subtasks) ? subtasks : (subtasks?.issues ?? subtasks?.data ?? []);

    let out = `Issue: ${issue.identifier ?? issue.id}\n`;
    out += `Title: ${issue.title}\n`;
    out += `Status: ${issue.status}\n`;
    out += `Priority: ${issue.priority ?? 'N/A'}\n`;
    if (issue.description) out += `Description: ${issue.description}\n`;

    if (commentList.length > 0) {
      out += `\nComments (${commentList.length}):\n`;
      for (const c of commentList.slice(-5)) {
        const author = c.agentId ? `agent:${c.agentId.substring(0, 8)}` : 'user';
        const time = c.createdAt ? new Date(c.createdAt).toLocaleTimeString() : '';
        out += `  [${time}] ${author}: ${c.body ?? c.content ?? ''}\n`;
      }
    }

    if (subtaskList.length > 0) {
      out += `\nSubtasks (${subtaskList.length}):\n`;
      for (const s of subtaskList) {
        out += `  ${s.identifier ?? s.id} [${s.status}] ${s.title}\n`;
      }
    }

    return out;
  }

  // Dashboard: all active work
  const data = await api(`/companies/${COMPANY_ID}/issues?status=in_progress,todo`);
  const issues = Array.isArray(data) ? data : (data?.issues ?? data?.data ?? []);

  if (issues.length === 0) return 'No active issues found.';

  let out = `Active Issues (${issues.length}):\n`;
  out += '─'.repeat(60) + '\n';
  for (const i of issues) {
    const assignee = i.assigneeAgentId ? i.assigneeAgentId.substring(0, 8) : 'none';
    out += `${(i.identifier ?? '???').padEnd(8)} [${(i.status ?? '').padEnd(12)}] ${(i.title ?? '').substring(0, 40).padEnd(40)} @${assignee}\n`;
  }
  return out;
}

// Tool: watch
async function handleWatch(args: Record<string, unknown>): Promise<string> {
  const issueId = String(args.issueId);
  const timeoutSeconds = Number(args.timeoutSeconds ?? 120);

  const TERMINAL_STATES = ['done', 'blocked', 'cancelled'];

  return new Promise<string>((resolve) => {
    let resolved = false;
    const finish = (text: string) => {
      if (!resolved) {
        resolved = true;
        resolve(text);
      }
    };

    const timer = setTimeout(async () => {
      ws.close();
      try {
        const [issue, comments] = await Promise.all([
          api(`/issues/${issueId}`),
          api(`/issues/${issueId}/comments`).catch(() => []),
        ]);
        const commentList = Array.isArray(comments) ? comments : (comments?.comments ?? comments?.data ?? []);
        const latest = commentList.length > 0 ? commentList[commentList.length - 1] : null;
        finish(
          `Watch timed out after ${timeoutSeconds}s.\n` +
          `Current status: ${issue.status}\n` +
          (latest ? `Latest comment: ${latest.body ?? latest.content ?? ''}` : 'No comments.')
        );
      } catch (e) {
        finish(`Watch timed out after ${timeoutSeconds}s. Could not fetch status.`);
      }
    }, timeoutSeconds * 1000);

    const ws = new WebSocket(WS_URL);

    ws.on('error', (err) => {
      clearTimeout(timer);
      finish(`WebSocket error: ${err.message}`);
    });

    ws.on('close', () => {
      clearTimeout(timer);
      finish('WebSocket closed unexpectedly.');
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Check if this event relates to our issue and has a terminal state
        const eventIssueId = msg.issueId ?? msg.data?.id ?? msg.data?.issueId;
        const newStatus = msg.status ?? msg.data?.status;

        if (eventIssueId === issueId && TERMINAL_STATES.includes(newStatus)) {
          clearTimeout(timer);
          ws.close();

          const comments = await api(`/issues/${issueId}/comments`).catch(() => []);
          const commentList = Array.isArray(comments) ? comments : (comments?.comments ?? comments?.data ?? []);
          const latest = commentList.length > 0 ? commentList[commentList.length - 1] : null;

          finish(
            `Issue transitioned to: ${newStatus}\n` +
            (latest ? `CEO response: ${latest.body ?? latest.content ?? ''}` : 'No comments found.')
          );
        }
      } catch {
        // Not JSON or unrelated message, ignore
      }
    });
  });
}

// Tool: inbox
async function handleInbox(): Promise<string> {
  const data = await api(`/companies/${COMPANY_ID}/issues`);
  const issues = Array.isArray(data) ? data : (data?.issues ?? data?.data ?? []);

  // Sort by updatedAt desc and take last 10
  const sorted = issues
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  if (sorted.length === 0) return 'Inbox empty.';

  let out = 'Inbox (last 10 updated):\n';
  out += `${'ID'.padEnd(8)} ${'Title'.padEnd(35)} ${'Status'.padEnd(14)} ${'Assignee'.padEnd(10)} Updated\n`;
  out += '─'.repeat(80) + '\n';

  for (const i of sorted) {
    const id = (i.identifier ?? '???').padEnd(8);
    const title = (i.title ?? '').substring(0, 33).padEnd(35);
    const status = (i.status ?? '').padEnd(14);
    const assignee = i.assigneeAgentId ? i.assigneeAgentId.substring(0, 8).padEnd(10) : 'none'.padEnd(10);
    const updated = i.updatedAt ? new Date(i.updatedAt).toLocaleString() : 'N/A';
    out += `${id} ${title} ${status} ${assignee} ${updated}\n`;
  }

  return out;
}

// Server setup
const server = new Server(
  { name: 'paperclip-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'delegate',
      description:
        'Delegate a task to the Paperclip CEO agent. Creates an issue and assigns it. Use for any work you want the AI team to handle.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          message: {
            type: 'string',
            description: 'The task description to delegate',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Priority level (default: medium)',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'status',
      description:
        'Check status of a specific issue or get a dashboard of all active work.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          issueId: {
            type: 'string',
            description: 'Specific issue ID to check. Omit for active work dashboard.',
          },
        },
      },
    },
    {
      name: 'watch',
      description:
        'Watch an issue via WebSocket until it reaches a terminal state (done/blocked/cancelled). Returns the CEO final response.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          issueId: {
            type: 'string',
            description: 'The issue ID to watch',
          },
          timeoutSeconds: {
            type: 'number',
            description: 'Max seconds to wait (default: 120)',
          },
        },
        required: ['issueId'],
      },
    },
    {
      name: 'inbox',
      description:
        'View the last 10 issues sorted by most recently updated. Quick overview of all work.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    let result: string;
    switch (name) {
      case 'delegate':
        result = await handleDelegate(a);
        break;
      case 'status':
        result = await handleStatus(a);
        break;
      case 'watch':
        result = await handleWatch(a);
        break;
      case 'inbox':
        result = await handleInbox();
        break;
      default:
        result = `Unknown tool: ${name}`;
    }
    return { content: [{ type: 'text', text: result }] };
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message ?? err}` }],
      isError: true,
    };
  }
});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
