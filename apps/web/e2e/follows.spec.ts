import { expect, test } from "@playwright/test";

import { API, requestVerifyUrl } from "./helpers";

/**
 * Friends flow: follow a user from their public profile, find them in
 * /friends, then compare maps on the main globe (legend visible).
 */
test("follow from profile → /friends list → compare on the map", async ({
  page,
  browser,
  request,
}) => {
  // Fresh users per run — the dev DB keeps state between runs.
  const stamp = Date.now();
  const friendEmail = `e2e-friend-${stamp}@example.com`;
  const friendUsername = `e2e_friend_${stamp}`;
  const myEmail = `e2e-me-${stamp}@example.com`;
  const myUsername = `e2e_me_${stamp}`;

  // --- Set up the friend in an isolated context: claim a handle and mark
  // two countries through their session cookies.
  const friendContext = await browser.newContext();
  const friendPage = await friendContext.newPage();
  await friendPage.goto(await requestVerifyUrl(request, friendEmail));
  await friendPage.waitForURL(/localhost:3000/);
  const claim = await friendPage.request.patch(`${API}/me`, {
    headers: { "X-Requested-With": "fetch" },
    data: { username: friendUsername },
  });
  expect(claim.ok()).toBeTruthy();
  for (const code of ["BR", "AR"]) {
    const marked = await friendPage.request.put(`${API}/me/visits/${code}`, {
      headers: { "X-Requested-With": "fetch" },
      data: {},
    });
    expect(marked.ok()).toBeTruthy();
  }
  const friendDisplayName = (
    (await (await friendPage.request.get(`${API}/auth/me`)).json()) as {
      displayName: string;
    }
  ).displayName;
  await friendContext.close();

  // --- Log in as myself and mark one shared country (BR → overlap).
  await page.goto(await requestVerifyUrl(request, myEmail));
  await page.waitForURL(/localhost:3000/);
  const myClaim = await page.request.patch(`${API}/me`, {
    headers: { "X-Requested-With": "fetch" },
    data: { username: myUsername },
  });
  expect(myClaim.ok()).toBeTruthy();
  const myMark = await page.request.put(`${API}/me/visits/BR`, {
    headers: { "X-Requested-With": "fetch" },
    data: {},
  });
  expect(myMark.ok()).toBeTruthy();

  // --- Follow the friend from their public profile.
  await page.goto(`/${friendUsername}`);
  const followButton = page.getByTestId("follow-button");
  await expect(followButton).toHaveText("Follow");
  await followButton.click();
  await expect(followButton).toHaveText("Following");

  // --- The friend appears in /friends (header link) with country count.
  await page.goto("/");
  await page.getByTestId("friends-link").click();
  await page.waitForURL(/\/friends$/);
  const card = page.getByTestId(`friend-card-${friendUsername}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText(friendDisplayName);
  await expect(card.getByTestId("friend-country-count")).toHaveText("2");
  await expect(card.getByTestId("follow-button")).toHaveText("Following");

  // --- Search finds the friend too (already-following state shown).
  await page.getByTestId("friend-search").fill(friendUsername);
  const result = page
    .getByTestId("search-results")
    .getByTestId(`friend-card-${friendUsername}`);
  await expect(result).toBeVisible();
  await expect(result.getByTestId("follow-button")).toHaveText("Following");
  await page.getByTestId("friend-search").fill("");

  // --- "View on map" enters compare mode on the main map with a legend.
  await page.getByTestId(`view-on-map-${friendUsername}`).click();
  await page.waitForURL(/localhost:3000\/$/);
  await expect(page.getByTestId("map-canvas")).toBeVisible();
  const legend = page.getByTestId("compare-legend");
  await expect(legend).toBeVisible();
  await expect(legend.getByTestId("compare-friend-name")).toHaveText(
    friendDisplayName,
  );
  await expect(legend).toContainText("You");
  await expect(legend).toContainText("Both");

  // Exiting compare mode removes the legend.
  await page.getByTestId("compare-exit").click();
  await expect(legend).toHaveCount(0);

  // --- Self-follow impossible in the UI: my own profile has no follow
  // button, just the edit link.
  await page.goto(`/${myUsername}`);
  await expect(page.getByTestId("edit-map-link")).toBeVisible();
  await expect(page.getByTestId("follow-button")).toHaveCount(0);
});
