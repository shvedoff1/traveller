import { expect, test } from "@playwright/test";

/**
 * Mobile smoke (375px): the country panel collapses to a floating search
 * pill that expands into a bottom sheet, touch targets are ≥44px, and the
 * theme toggle flips + persists.
 */
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

test("pill expands to the bottom sheet; touch targets are ≥44px", async ({
  page,
}) => {
  await page.goto("/");

  // Logged-out landing: idle globe + tagline CTA.
  await expect(page.getByTestId("landing-hero")).toBeVisible();
  await expect(page.getByTestId("landing-cta")).toHaveAttribute(
    "href",
    "/login",
  );

  // Collapsed by default on mobile: pill visible, panel hidden.
  const pill = page.getByTestId("country-panel-pill");
  await expect(pill).toBeVisible();
  await expect(page.getByTestId("country-panel")).toBeHidden();

  // ≥44px touch target.
  const pillBox = await pill.boundingBox();
  expect(pillBox!.height).toBeGreaterThanOrEqual(44);

  // Pill opens the bottom sheet, anchored to the bottom edge (poll: the
  // sheet rises in with a 200ms animation).
  await pill.click();
  const panel = page.getByTestId("country-panel");
  await expect(panel).toBeVisible();
  await expect(pill).toBeHidden();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return {
        x: box!.x,
        width: box!.width,
        bottom: Math.round(box!.y + box!.height),
      };
    })
    .toEqual({ x: 0, width: 375, bottom: 667 });

  // Search works inside the sheet; rows are comfortably tappable.
  await page.getByTestId("country-search").fill("Japan");
  const row = page.getByTestId("country-row-JP");
  await expect(row).toBeVisible();
  const rowBox = await row.boundingBox();
  expect(rowBox!.height).toBeGreaterThanOrEqual(44);

  // Collapse brings the pill back.
  await page.getByTestId("country-panel-collapse").click();
  await expect(panel).toBeHidden();
  await expect(pill).toBeVisible();

  // Compact stats bar: count visible, continent breakdown hidden.
  await expect(page.getByTestId("stats-count")).toBeVisible();
  await expect(
    page.getByTestId("stats-bar").getByRole("listitem").first(),
  ).toBeHidden();
});

test("theme toggle flips the palette and persists across reloads", async ({
  page,
}) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", /dark|light/);
  const initial = await html.getAttribute("data-theme");
  const flipped = initial === "dark" ? "light" : "dark";

  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", flipped);

  // The explicit choice is stored and wins over the OS preference.
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", flipped);

  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", initial!);
});

test("unknown routes render the themed 404 page", async ({ page }) => {
  const response = await page.goto("/no/such/page");
  expect(response!.status()).toBe(404);
  await expect(page.getByText("Off the map")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the globe" }),
  ).toBeVisible();
});
