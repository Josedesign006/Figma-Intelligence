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
export declare function handleWebhookEvent(event: WebhookEventPayload, subscription: WebhookSubscription): Promise<Record<string, unknown>>;
export declare function webhookListenerHandler(args: WebhookListenerArgs): Promise<WebhookListenerResult>;
//# sourceMappingURL=index.d.ts.map