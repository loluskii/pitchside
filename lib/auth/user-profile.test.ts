import { describe, expect, it } from "vitest";

import { extractCurrentUserProfile } from "@/lib/auth/user-profile";

describe("extractCurrentUserProfile", () => {
  it("uses the backend profile id instead of the login username fallback", () => {
    const profile = extractCurrentUserProfile(
      {
        data: {
          id: 16,
          username: "08012345678",
          balance: 5000,
        },
      },
      "08099999999",
    );

    expect(profile?.id).toBe(16);
    expect(profile?.username).toBe("08012345678");
  });

  it("extracts the player id from a direct user object", () => {
    const profile = extractCurrentUserProfile({
      id: 271624,
      username: "7044346343",
      balance: 995936.75,
      availableBalance: 995936.75,
      currency: "NGN",
    });

    expect(profile?.id).toBe(271624);
    expect(profile?.username).toBe("7044346343");
    expect(profile?.availableBalance).toBe(995936.75);
  });

  it("does not use the login username as a profile id when id is missing", () => {
    const profile = extractCurrentUserProfile(
      {
        data: {
          username: "08012345678",
          balance: 5000,
        },
      },
      "08099999999",
    );

    expect(profile?.id).toBe("");
  });
});
