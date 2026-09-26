import { expect, test } from "@playwright/test";

import { API, requestVerifyUrl } from "./helpers";

/**
 * Groups smoke: create a group, share the invite link, a second user joins
 * through it and both maps add up in the group stats.
 */
test("create a group, join by invite link, see combined stats", async ({
  browser,
  request,
}) => {
  const stamp = Date.now();

  async function signIn(tag: string, countries: string[]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(
      await requestVerifyUrl(request, `e2e-${tag}-${stamp}@example.com`),
    );
    await page.waitForURL(/localhost:3000/);
    const username = `${tag}_${stamp}`.slice(0, 30);
    const claim = await page.request.patch(`${API}/me`, {
      headers: { "X-Requested-With": "fetch" },
      data: { username },
    });
    expect(claim.ok()).toBeTruthy();
    for (const code of countries) {
      const put = await page.request.put(`${API}/me/visits/${code}`, {
        headers: { "X-Requested-With": "fetch" },
        data: {},
      });
      expect(put.ok()).toBeTruthy();
    }
    return { page, username };
  }

  const owner = await signIn("gown", ["FR", "JP"]);
  await owner.page.goto("/groups");
  await owner.page.getByTestId("group-name-input").fill("E2E crew");
  await owner.page.getByTestId("group-create").click();
  await owner.page.waitForURL(/\/groups\/[0-9a-f-]{36}$/);
  await expect(owner.page.getByTestId("group-name")).toHaveText("E2E crew");
  await expect(owner.page.getByTestId("group-stat-countries")).toHaveText("2");

  const inviteLink = await owner.page
    .getByTestId("group-invite-link")
    .inputValue();
  expect(inviteLink).toMatch(/\/join\/[\w-]{12}$/);

  const friend = await signIn("gfr", ["FR", "BR"]);
  await friend.page.goto(inviteLink);
  await expect(friend.page.getByTestId("invite-card")).toContainText(
    "E2E crew",
  );
  await friend.page.getByTestId("invite-join").click();
  await friend.page.waitForURL(/\/groups\/[0-9a-f-]{36}$/);

  // FR + JP + BR together; France is the one everyone has been to.
  await expect(friend.page.getByTestId("group-stat-countries")).toHaveText(
    "3",
  );
  await expect(friend.page.getByTestId("group-stat-shared")).toHaveText("1");
  await expect(friend.page.getByTestId("group-shared")).toContainText(
    "France",
  );
  await expect(
    friend.page.getByTestId(`group-member-${owner.username}`),
  ).toBeVisible();

  // The header links to groups.
  await friend.page.goto("/");
  await friend.page.getByTestId("groups-link").click();
  await expect(friend.page.getByText("E2E crew")).toBeVisible();

  await owner.page.context().close();
  await friend.page.context().close();
});
