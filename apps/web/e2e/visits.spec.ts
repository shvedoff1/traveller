import { type APIRequestContext, expect, test } from "@playwright/test";

const API = "http://localhost:4000";
const MAILPIT = "http://localhost:8025";

/**
 * Seed-login via magic link: request a link through the API, pull the mail
 * out of Mailpit's HTTP API and return the verify URL.
 */
async function requestVerifyUrl(
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

test("mark a country via the panel, edit details, survive reload", async ({
  page,
  request,
}) => {
  // Fresh user per run — the dev DB keeps state between runs.
  const email = `e2e-${Date.now()}@example.com`;
  const verifyUrl = await requestVerifyUrl(request, email);

  // Visiting the verify URL sets the auth cookies and redirects to the app.
  await page.goto(verifyUrl);
  await page.waitForURL(/localhost:3000/);
  await page.goto("/");
  await expect(page.getByTestId("user-chip")).toBeVisible();

  const panel = page.getByTestId("country-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("stats-count")).toHaveText("0");

  // Search filters the list; picking the row marks the country.
  await page.getByTestId("country-search").fill("France");
  const franceRow = page.getByTestId("country-row-FR");
  await franceRow.click();
  await expect(franceRow).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("stats-count")).toHaveText("1");
  await expect(page.getByTestId("visited-heading")).toHaveText("Visited (1)");

  // The detail sheet opened — save a year and a note.
  const sheet = page.getByTestId("country-detail-sheet");
  await expect(sheet).toContainText("France");
  await page.getByTestId("visit-year").selectOption("2019");
  await page.getByTestId("visit-note").fill("Croissants in Paris");
  await page.getByTestId("visit-save").click();

  // Survives reload.
  await page.reload();
  await expect(page.getByTestId("stats-count")).toHaveText("1");
  await expect(page.getByTestId("visited-heading")).toHaveText("Visited (1)");
  await expect(page.getByTestId("visited-row-FR")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Year + note re-display in the sheet for a visited country.
  await page.getByTestId("country-search").fill("France");
  await page.getByTestId("country-row-FR").click();
  await expect(page.getByTestId("visit-year")).toHaveValue("2019");
  await expect(page.getByTestId("visit-note")).toHaveValue(
    "Croissants in Paris",
  );

  // Unmark from the sheet.
  await page.getByTestId("visit-unmark").click();
  await expect(page.getByTestId("stats-count")).toHaveText("0");
  await expect(page.getByTestId("country-row-FR")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("logged-out visitors get a login prompt instead of a mutation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("country-panel")).toBeVisible();
  // Wait for the auth check to settle (login link appears in the header).
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

  await page.getByTestId("country-search").fill("Japan");
  await page.getByTestId("country-row-JP").click();

  await expect(page.getByTestId("login-prompt")).toBeVisible();
  await expect(page.getByTestId("country-row-JP")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("stats-count")).toHaveText("0");
});
