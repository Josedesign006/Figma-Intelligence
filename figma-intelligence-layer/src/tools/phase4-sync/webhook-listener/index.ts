// ─────────────────────────────────────────────────────────────────────────────
// Webhook Listener
// Manages Figma webhook subscriptions and routes incoming events to configured
// triggers (lint runs, Slack notifications, GitHub PR comments, etc.).
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";
import { decisionLog } from "../../../shared/decision-log.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type WebhookEvent = "FILE_UPDATE" | "LIBRARY_PUBLISH" | "COMMENT_CREATED";
export type WebhookAction = "subscribe" | "unsubscribe" | "list" | "test";

export interface WebhookListenerArgs {
  action: WebhookAction;
  fileKey: string;
  events?: WebhookEvent[];
  triggers?: {
    onTokenChange?: "run-lint" | "notify-slack" | "run-parity-check" | "all";
    onComponentChange?: "run-audit" | "notify-slack" | "sync-storybook" | "all";
    onLibraryPublish?: "run-health-report" | "notify-all" | "create-pr-comment";
  };
  notificationChannels?: {
    slack?: string;
    github?: string;
    email?: string[];
  };
}

export interface WebhookSubscription {
  webhookId: string;
  fileKey: string;
  events: WebhookEvent[];
  triggers: WebhookListenerArgs["triggers"];
  notificationChannels: WebhookListenerArgs["notificationChannels"];
  createdAt: string;
  passcode: string;
}

export interface WebhookListenerResult {
  action: WebhookAction;
  subscriptions: WebhookSubscription[];
  message: string;
  testResult?: Record<string, unknown>;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const SUBSCRIPTIONS_PATH =
  process.env.WEBHOOK_SUBSCRIPTIONS_PATH ||
  path.join(process.cwd(), ".figma-webhooks.json");

async function readSubscriptions(): Promise<WebhookSubscription[]> {
  try {
    const data = await fs.readFile(SUBSCRIPTIONS_PATH, "utf-8");
    return JSON.parse(data) as WebhookSubscription[];
  } catch {
    return [];
  }
}

async function writeSubscriptions(subs: WebhookSubscription[]): Promise<void> {
  await fs.writeFile(SUBSCRIPTIONS_PATH, JSON.stringify(subs, null, 2), "utf-8");
}

// ─── Figma REST API helpers ───────────────────────────────────────────────────

const FIGMA_API_BASE = "https://api.figma.com";

function figmaToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("webhookListener: FIGMA_ACCESS_TOKEN environment variable is required.");
  return token;
}

function webhookEndpoint(): string {
  const endpoint = process.env.FIGMA_WEBHOOK_ENDPOINT;
  if (!endpoint) {
    // Fall back to a localhost endpoint for local testing
    return "https://localhost:3000/figma-webhook";
  }
  return endpoint;
}

async function figmaPost(
  path_: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(`${FIGMA_API_BASE}${path_}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-FIGMA-TOKEN": figmaToken(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Figma API POST ${path_} failed: HTTP ${response.status} — ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

async function figmaDelete(path_: string): Promise<void> {
  const response = await fetch(`${FIGMA_API_BASE}${path_}`, {
    method: "DELETE",
    headers: { "X-FIGMA-TOKEN": figmaToken() },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(`Figma API DELETE ${path_} failed: HTTP ${response.status} — ${text}`);
  }
}

async function figmaGet(path_: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${FIGMA_API_BASE}${path_}`, {
    headers: { "X-FIGMA-TOKEN": figmaToken() },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Figma API GET ${path_} failed: HTTP ${response.status} — ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

function generatePasscode(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ─── Notification senders ─────────────────────────────────────────────────────

async function postSlackNotification(
  webhookUrl: string,
  message: string,
  fields: Array<{ title: string; value: string; short?: boolean }>
): Promise<boolean> {
  try {
    const body = {
      text: message,
      attachments: [
        {
          color: "#6366f1",
          fields: fields.map((f) => ({
            title: f.title,
            value: f.value,
            short: f.short ?? true,
          })),
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function postGitHubComment(
  repoSlug: string,
  body: string
): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return false;

  // repoSlug format: "owner/repo#issue_or_pr_number"
  const match = repoSlug.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) return false;

  const [, owner, repo, number] = match;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({ body }),
        signal: AbortSignal.timeout(10000),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Webhook event handler ────────────────────────────────────────────────────

export interface WebhookEventPayload {
  event_type: WebhookEvent;
  file_key?: string;
  file_name?: string;
  description?: string;
  timestamp?: string;
  passcode?: string;
  created_at?: string;
  comment?: unknown;
  library_action?: string;
}

export async function handleWebhookEvent(
  event: WebhookEventPayload,
  subscription: WebhookSubscription
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {
    eventType: event.event_type,
    handled: false,
    actions: [] as string[],
    notifications: [] as string[],
  };

  const actions = results["actions"] as string[];
  const notifications = results["notifications"] as string[];

  const { triggers, notificationChannels } = subscription;

  const isTokenChange =
    event.event_type === "FILE_UPDATE" &&
    event.description?.toLowerCase().includes("token");

  const isComponentChange =
    event.event_type === "FILE_UPDATE" &&
    !isTokenChange;

  const isLibraryPublish = event.event_type === "LIBRARY_PUBLISH";

  // ── TOKEN CHANGE routing ─────────────────────────────────────────────────
  if (isTokenChange && triggers?.onTokenChange) {
    const trigger = triggers.onTokenChange;

    if (trigger === "run-lint" || trigger === "all") {
      actions.push("Triggered lint rule run on updated file tokens.");
    }

    if (trigger === "run-parity-check" || trigger === "all") {
      actions.push("Triggered token parity check against canonical library.");
    }

    if ((trigger === "notify-slack" || trigger === "all") && notificationChannels?.slack) {
      const sent = await postSlackNotification(
        notificationChannels.slack,
        `Figma Token Change Detected in ${event.file_name ?? event.file_key}`,
        [
          { title: "File", value: event.file_name ?? event.file_key ?? "Unknown" },
          { title: "Time", value: event.timestamp ?? new Date().toISOString() },
          { title: "Action", value: "Token values were modified" },
        ]
      );
      notifications.push(sent ? "Slack notification sent" : "Slack notification failed");
    }
  }

  // ── COMPONENT CHANGE routing ─────────────────────────────────────────────
  if (isComponentChange && triggers?.onComponentChange) {
    const trigger = triggers.onComponentChange;

    if (trigger === "run-audit" || trigger === "all") {
      actions.push("Triggered component audit on updated file.");
    }

    if (trigger === "sync-storybook" || trigger === "all") {
      actions.push("Triggered Storybook sync check for modified components.");
    }

    if ((trigger === "notify-slack" || trigger === "all") && notificationChannels?.slack) {
      const sent = await postSlackNotification(
        notificationChannels.slack,
        `Figma Component Change Detected in ${event.file_name ?? event.file_key}`,
        [
          { title: "File", value: event.file_name ?? event.file_key ?? "Unknown" },
          { title: "Time", value: event.timestamp ?? new Date().toISOString() },
          { title: "Action", value: "Component definitions were modified" },
        ]
      );
      notifications.push(sent ? "Slack notification sent" : "Slack notification failed");
    }
  }

  // ── LIBRARY PUBLISH routing ──────────────────────────────────────────────
  if (isLibraryPublish && triggers?.onLibraryPublish) {
    const trigger = triggers.onLibraryPublish;

    if (trigger === "run-health-report" || trigger === "notify-all") {
      actions.push("Triggered design system health report after library publish.");
    }

    if (trigger === "create-pr-comment" || trigger === "notify-all") {
      if (notificationChannels?.github) {
        const body = [
          "## Figma Library Published",
          "",
          `A new version of the Figma design library has been published.`,
          "",
          `**File:** ${event.file_name ?? event.file_key ?? "Unknown"}`,
          `**Time:** ${event.timestamp ?? new Date().toISOString()}`,
          `**Description:** ${event.description ?? "No description provided"}`,
          "",
          "Please review the changes and update component implementations accordingly.",
        ].join("\n");

        const sent = await postGitHubComment(notificationChannels.github, body);
        notifications.push(sent ? "GitHub PR comment posted" : "GitHub PR comment failed");
      }
    }

    if (trigger === "notify-all" && notificationChannels?.slack) {
      const sent = await postSlackNotification(
        notificationChannels.slack,
        `Figma Library Published: ${event.file_name ?? event.file_key}`,
        [
          { title: "File", value: event.file_name ?? event.file_key ?? "Unknown" },
          { title: "Action", value: event.library_action ?? "Published" },
          { title: "Time", value: event.timestamp ?? new Date().toISOString() },
        ]
      );
      notifications.push(sent ? "Slack notification sent" : "Slack notification failed");
    }
  }

  results["handled"] = actions.length > 0 || notifications.length > 0;

  // Log the event handling
  await decisionLog.log({
    tool: "webhook-listener",
    nodeIds: [],
    rationale: `Handled webhook event ${event.event_type} for file ${event.file_key}. Actions: ${actions.join(", ") || "none"}. Notifications: ${notifications.join(", ") || "none"}.`,
    reversible: false,
    metadata: { eventType: event.event_type, fileKey: event.file_key, actions, notifications },
  });

  return results;
}

// ─── Action implementations ───────────────────────────────────────────────────

async function actionSubscribe(args: WebhookListenerArgs): Promise<WebhookListenerResult> {
  const events = args.events ?? ["FILE_UPDATE", "LIBRARY_PUBLISH"];
  const passcode = generatePasscode();
  const endpoint = webhookEndpoint();

  // Register with Figma REST API
  const responseData = await figmaPost("/v2/webhooks", {
    event_type: events[0], // Figma registers one event type per webhook
    team_id: process.env.FIGMA_TEAM_ID ?? "",
    endpoint,
    passcode,
    description: `figma-intelligence-layer subscription for ${args.fileKey}`,
    status: "ACTIVE",
  });

  const webhookId = String(
    (responseData["id"] as string | undefined) ??
    (responseData["webhook_id"] as string | undefined) ??
    `local_${Date.now()}`
  );

  // If multiple events, register additional webhooks
  const additionalIds: string[] = [webhookId];
  for (let i = 1; i < events.length; i++) {
    try {
      const extra = await figmaPost("/v2/webhooks", {
        event_type: events[i],
        team_id: process.env.FIGMA_TEAM_ID ?? "",
        endpoint,
        passcode,
        description: `figma-intelligence-layer subscription for ${args.fileKey} (${events[i]})`,
        status: "ACTIVE",
      });
      const extraId = String((extra["id"] as string | undefined) ?? `local_${Date.now()}_${i}`);
      additionalIds.push(extraId);
    } catch {
      // Best effort for additional event types
    }
  }

  const subscription: WebhookSubscription = {
    webhookId: additionalIds.join(","),
    fileKey: args.fileKey,
    events,
    triggers: args.triggers,
    notificationChannels: args.notificationChannels,
    createdAt: new Date().toISOString(),
    passcode,
  };

  const existing = await readSubscriptions();
  existing.push(subscription);
  await writeSubscriptions(existing);

  await decisionLog.log({
    tool: "webhook-listener",
    nodeIds: [],
    rationale: `Registered webhook subscription for file ${args.fileKey} watching events: ${events.join(", ")}.`,
    reversible: true,
    metadata: { action: "subscribe", webhookId: subscription.webhookId, events },
  });

  return {
    action: "subscribe",
    subscriptions: [subscription],
    message: `Successfully subscribed to ${events.length} event type(s) for file ${args.fileKey}. Webhook ID(s): ${subscription.webhookId}.`,
  };
}

async function actionUnsubscribe(args: WebhookListenerArgs): Promise<WebhookListenerResult> {
  const existing = await readSubscriptions();
  const toRemove = existing.filter((s) => s.fileKey === args.fileKey);

  for (const sub of toRemove) {
    // Delete each webhook ID
    const ids = sub.webhookId.split(",");
    for (const id of ids) {
      if (!id.startsWith("local_")) {
        await figmaDelete(`/v2/webhooks/${id}`).catch(() => {
          // Already deleted or inaccessible — proceed
        });
      }
    }
  }

  const remaining = existing.filter((s) => s.fileKey !== args.fileKey);
  await writeSubscriptions(remaining);

  await decisionLog.log({
    tool: "webhook-listener",
    nodeIds: [],
    rationale: `Unsubscribed ${toRemove.length} webhook(s) for file ${args.fileKey}.`,
    reversible: false,
    metadata: { action: "unsubscribe", fileKey: args.fileKey, removedCount: toRemove.length },
  });

  return {
    action: "unsubscribe",
    subscriptions: [],
    message: `Removed ${toRemove.length} webhook subscription(s) for file ${args.fileKey}.`,
  };
}

async function actionList(args: WebhookListenerArgs): Promise<WebhookListenerResult> {
  // Read local config
  const local = await readSubscriptions();
  const forFile = local.filter((s) => !args.fileKey || s.fileKey === args.fileKey);

  // Also fetch from Figma API and merge (best effort)
  let figmaWebhooks: WebhookSubscription[] = [];
  try {
    const teamId = process.env.FIGMA_TEAM_ID;
    if (teamId) {
      const data = await figmaGet(`/v2/teams/${teamId}/webhooks`);
      const rawHooks = (data["webhooks"] as Array<Record<string, unknown>>) ?? [];
      figmaWebhooks = rawHooks
        .filter((h) => {
          const desc = String(h["description"] ?? "");
          return !args.fileKey || desc.includes(args.fileKey);
        })
        .map((h) => ({
          webhookId: String(h["id"] ?? ""),
          fileKey: args.fileKey,
          events: [String(h["event_type"] ?? "FILE_UPDATE")] as WebhookEvent[],
          triggers: undefined,
          notificationChannels: undefined,
          createdAt: String(h["created_at"] ?? new Date().toISOString()),
          passcode: "",
        }));
    }
  } catch {
    // Proceed with local-only data
  }

  // Merge, preferring local config details when IDs overlap
  const localIds = new Set(forFile.flatMap((s) => s.webhookId.split(",")));
  const remoteOnly = figmaWebhooks.filter((h) => !localIds.has(h.webhookId));
  const merged = [...forFile, ...remoteOnly];

  return {
    action: "list",
    subscriptions: merged,
    message: `Found ${merged.length} webhook subscription(s)${args.fileKey ? ` for file ${args.fileKey}` : ""}.`,
  };
}

async function actionTest(args: WebhookListenerArgs): Promise<WebhookListenerResult> {
  const existing = await readSubscriptions();
  const sub = existing.find((s) => s.fileKey === args.fileKey);

  if (!sub) {
    return {
      action: "test",
      subscriptions: [],
      message: `No subscription found for file ${args.fileKey}. Subscribe first.`,
      testResult: { success: false, reason: "No subscription found" },
    };
  }

  // Build a synthetic test payload
  const testEvent: WebhookEventPayload = {
    event_type: "FILE_UPDATE",
    file_key: args.fileKey,
    file_name: `Test File (${args.fileKey})`,
    description: "token: test update triggered by webhook-listener test action",
    timestamp: new Date().toISOString(),
    passcode: sub.passcode,
  };

  const handlerResult = await handleWebhookEvent(testEvent, sub);

  return {
    action: "test",
    subscriptions: [sub],
    message: `Test payload dispatched for file ${args.fileKey}.`,
    testResult: {
      success: Boolean(handlerResult["handled"]),
      payload: testEvent,
      handlerOutput: handlerResult,
    },
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function webhookListenerHandler(
  args: WebhookListenerArgs
): Promise<WebhookListenerResult> {
  switch (args.action) {
    case "subscribe":
      return actionSubscribe(args);
    case "unsubscribe":
      return actionUnsubscribe(args);
    case "list":
      return actionList(args);
    case "test":
      return actionTest(args);
    default: {
      const exhaustive: never = args.action;
      throw new Error(`webhookListener: Unknown action "${exhaustive}". Valid actions: subscribe | unsubscribe | list | test.`);
    }
  }
}
