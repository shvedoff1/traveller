import { expect, test } from "@playwright/test";

import { API, requestVerifyUrl } from "./helpers";

const WEB = "http://localhost:3000";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("public profile: logged-out render, share, casing redirect, OG image", async ({
  page,
  browser,
  request,
}) => {
  // Fresh user per run — the dev DB keeps state between runs.
  const stamp = Date.now();
  const email = `e2e-profile-${stamp}@example.com`;
  const username = `e2e_prof_${stamp}`;

  const verifyUrl = await requestVerifyUrl(request, email);
  await page.goto(verifyUrl);
  await page.waitForURL(/localhost:3000/);

  // Claim a username through the page's session cookies.
  const claim = await page.request.patch(`${API}/me`, {
    headers: { "X-Requested-With": "fetch" },
    data: { username },
  });
  expect(claim.ok()).toBeTruthy();
  const me = (await (await page.request.get(`${API}/auth/me`)).json()) as {
    displayName: string;
  };

  // Mark France on the own map.
  await page.goto("/");
  await expect(page.getByTestId("user-chip")).toBeVisible();
  await page.getByTestId("country-search").fill("France");
  await page.getByTestId("country-row-FR").click();
  await expect(page.getByTestId("stats-count")).toHaveText("1");

  // The visit PUT invalidates the profile cache: the public API reflects
  // the mark as soon as the request lands.
  await expect
    .poll(async () => {
      const res = await request.get(`${API}/users/${username}`);
      return res.ok()
        ? ((await res.json()) as { counts: { countries: number } }).counts
            .countries
        : -1;
    })
    .toBe(1);

  // Own profile shows the edit link back to the map.
  await page.goto(`/${username}`);
  await expect(page.getByTestId("edit-map-link")).toBeVisible();

  // Fresh logged-out context: header, stats and read-only map render.
  const anon = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const anonPage = await anon.newPage();
  await anonPage.goto(`${WEB}/${username}`);
  await expect(anonPage.getByTestId("profile-name")).toHaveText(
    me.displayName,
  );
  await expect(anonPage.getByTestId("profile-username")).toHaveText(
    `@${username}`,
  );
  await expect(anonPage.getByTestId("stats-count")).toHaveText("1");
  await expect(anonPage.getByTestId("map-canvas")).toBeVisible();
  await expect(anonPage.getByTestId("edit-map-link")).toHaveCount(0);
  await expect(anonPage.getByTestId("follow-button")).toBeDisabled();

  // Share button copies the public URL and shows the toast.
  await anonPage.getByTestId("share-button").click();
  await expect(anonPage.getByTestId("share-toast")).toBeVisible();
  const copied = await anonPage.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(copied).toBe(`${WEB}/${username}`);

  // Non-canonical casing permanently redirects to the lowercase URL.
  await anonPage.goto(`${WEB}/${username.toUpperCase()}`);
  await expect(anonPage).toHaveURL(`${WEB}/${username}`);
  await expect(anonPage.getByTestId("profile-username")).toHaveText(
    `@${username}`,
  );
  await anon.close();

  // The OG image route serves a 1200x630 PNG.
  const og = await request.get(`${WEB}/${username}/opengraph-image`);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
  const body = await og.body();
  expect(body.subarray(0, 8)).toEqual(PNG_MAGIC);
  // IHDR width/height are big-endian u32s at offsets 16/20.
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});

test("unknown profiles 404", async ({ request }) => {
  const missing = await request.get(`${WEB}/nobody_here_404`);
  expect(missing.status()).toBe(404);
});
