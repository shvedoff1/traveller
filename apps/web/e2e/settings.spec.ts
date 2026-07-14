import { expect, test } from "@playwright/test";

import { API, requestVerifyUrl } from "./helpers";

const WEB = "http://localhost:3000";

test("header profile link + /settings edits the display name", async ({
  page,
  request,
}) => {
  // Fresh user per run — the dev DB keeps state between runs.
  const stamp = Date.now();
  const email = `e2e-settings-${stamp}@example.com`;
  const username = `e2e_set_${stamp}`;

  const verifyUrl = await requestVerifyUrl(request, email);
  await page.goto(verifyUrl);
  await page.waitForURL(/localhost:3000/);

  // Claim a username through the page's session cookies.
  const claim = await page.request.patch(`${API}/me`, {
    headers: { "X-Requested-With": "fetch" },
    data: { username },
  });
  expect(claim.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByTestId("user-chip")).toBeVisible();

  // The header avatar/name links to the owner's public profile and navigates.
  // waitForURL (not toHaveURL) so the first on-demand dev compile of the
  // /[username] route can't blow the 5s assertion default.
  const profileLink = page.getByTestId("profile-link");
  await expect(profileLink).toHaveAttribute("href", `/${username}`);
  await profileLink.click();
  await page.waitForURL(`${WEB}/${username}`);
  await expect(page.getByTestId("profile-username")).toHaveText(`@${username}`);

  // Reach settings from the header gear.
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await page.waitForURL(`${WEB}/settings`);

  // Prefilled with the email local-part default; change it and save.
  const nameInput = page.getByTestId("display-name-input");
  await expect(nameInput).toHaveValue(`e2e-settings-${stamp}`);
  await nameInput.fill("Jane Traveller");
  await page.getByTestId("settings-save").click();

  // Success toast confirms the PATCH landed.
  await expect(page.getByTestId("success-toast")).toBeVisible();

  // Durable + profile reflects it: PATCH /me invalidates the profile cache,
  // so the public API returns the new name (poll — mirrors profile.spec,
  // avoids the page's 60s ISR window).
  await expect
    .poll(async () => {
      const res = await page.request.get(`${API}/users/${username}`);
      return res.ok()
        ? ((await res.json()) as { displayName: string }).displayName
        : null;
    })
    .toBe("Jane Traveller");

  // The form re-reads ['me'] on reload with the saved value prefilled.
  await page.goto("/settings");
  await expect(page.getByTestId("display-name-input")).toHaveValue(
    "Jane Traveller",
  );
});
