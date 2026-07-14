import { type APIRequestContext, expect } from "@playwright/test";

// The API serves under the `/api` global prefix (matching Caddy in prod).
export const API = "http://localhost:4000/api";
export const MAILPIT = "http://localhost:8025";

/**
 * Seed-login via magic link: request a link through the API, pull the mail
 * out of Mailpit's HTTP API and return the verify URL.
 */
export async function requestVerifyUrl(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const response = await request.post(`${API}/auth/magic-link`, {
    headers: { "X-Requested-With": "fetch" },
    data: { email },
  });
  expect(response.ok()).toBeTruthy();

  // Mailpit ingests over SMTP — poll until the message shows up.
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        const body = (await search.json()) as {
          messages?: Array<{ ID: string }>;
        };
        messageId = body.messages?.[0]?.ID;
        return messageId;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();

  const message = await request.get(`${MAILPIT}/api/v1/message/${messageId}`);
  const body = (await message.json()) as { Text?: string; HTML?: string };
  const match = `${body.Text ?? ""}\n${body.HTML ?? ""}`.match(
    /https?:\/\/[^\s"'<>]+\/auth\/magic-link\/verify\?token=[\w.~-]+/,
  );
  expect(match, "verify link present in the email").toBeTruthy();
  return match![0];
}
