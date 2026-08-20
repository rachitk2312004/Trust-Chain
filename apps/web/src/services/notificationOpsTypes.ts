export type NotificationQueueStats = {
  pending: number;
  processing: number;
  retry: number;
  failed: number;
  sent: number;
  delivered: number;
  deadLetter: number;
  skipped: number;
  depth: number;
};

export type NotificationAnalytics = {
  generatedAt: string;
  queue: NotificationQueueStats;
  delivery: {
    totalOutbox: number;
    delivered: number;
    sent: number;
    failed: number;
    deadLetter: number;
    successRate: number | null;
    averageDeliveryTimeMs: number | null;
    sampleSize: number;
  };
  failures: {
    totalFailed: number;
    deadLetters: number;
    topErrors: Array<{ error: string; count: number }>;
    permanentHintCount: number;
  };
  retries: {
    retrying: number;
    averageAttemptsAmongRetries: number | null;
    maxAttemptsAmongRetries: number;
    highAttemptCount: number;
  };
  channels: {
    inAppNotifications: number;
    emailOutbox: number;
    emailPendingLike: number;
    emailDelivered: number;
  };
  digests: {
    immediate: number;
    daily: number;
    weekly: number;
    unknown: number;
    pendingDigest: number;
  };
  notificationsCreated: number;
  notificationsDeleted: number;
};

export type NotificationObservability = {
  generatedAt: string;
  process: {
    notificationsCreated: number;
    notificationsSent: number;
    notificationsDelivered: number;
    notificationsFailed: number;
    retryCount: number;
    deadLetterCount: number;
    digestVolume: number;
    averageDeliveryTimeMs: number | null;
    queueDepth: number;
    activeConnections: number;
  };
  durable: NotificationAnalytics;
  connections: { active: number };
};

export type DeadLetterList = {
  total: number;
  limit: number;
  offset: number;
  items: Array<{
    id: string;
    notificationId: string | null;
    userId: string;
    eventType: string;
    channel: string;
    attempts: number;
    lastError: string | null;
    createdAt: string;
    scheduledAt: string;
  }>;
};

export type RetentionPreview = {
  notificationsEligible: number;
  outboxEligible: number;
  policy: { deletedNotificationDays: number; terminalOutboxDays: number };
};

export type RetentionPurgeResult = {
  deletedNotifications: number;
  deletedOutbox: number;
  cutoffNotifications: string;
  cutoffOutbox: string;
  policy: { deletedNotificationDays: number; terminalOutboxDays: number };
};
