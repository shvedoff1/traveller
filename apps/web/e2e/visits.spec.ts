import { expect, test } from "@playwright/test";

import { requestVerifyUrl } from "./helpers";

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
