import { emailFingerprint } from "./auth.service";

describe("emailFingerprint", () => {
  it("is a short, stable hex id", () => {
    const id = emailFingerprint("alice@example.com");
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(emailFingerprint("alice@example.com")).toBe(id);
  });

  it("differs between addresses and never contains the address", () => {
    const a = emailFingerprint("alice@example.com");
    expect(emailFingerprint("bob@example.com")).not.toBe(a);
    expect(a).not.toContain("alice");
  });
});
