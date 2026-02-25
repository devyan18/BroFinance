import Expo, { ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends a push notification to one or more Expo push tokens.
 * Silently ignores invalid/expired tokens.
 */
export async function sendPushNotification(
  pushTokens: (string | undefined | null)[],
  payload: NotificationPayload,
): Promise<void> {
  const validTokens = pushTokens.filter(
    (t): t is string => !!t && Expo.isExpoPushToken(t),
  );

  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((to) => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch {
      // Silently ignore send errors (device offline, token expired, etc.)
    }
  }
}
