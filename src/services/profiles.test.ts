import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: null,
}));

describe("profile helpers", () => {
  it("normalizes display names for duplicate checks", async () => {
    const { normalizeDisplayName, sanitizeDisplayName } = await import("./profiles");

    expect(sanitizeDisplayName("  산   친구  ")).toBe("산 친구");
    expect(normalizeDisplayName("  Trail   USER  ")).toBe("trail user");
  });

  it("uses auth metadata before falling back to email for default display names", async () => {
    const { getDefaultDisplayName } = await import("./profiles");

    expect(
      getDefaultDisplayName({
        email: "fallback@example.com",
        user_metadata: { full_name: "  북한산 러버  " },
      }),
    ).toBe("북한산 러버");
    expect(getDefaultDisplayName({ email: "fallback@example.com", user_metadata: {} })).toBe("fallback");
  });

  it("detects only the current user's custom profile avatar storage paths", async () => {
    const { getProfileAvatarStoragePath, isCustomProfileAvatarUrl } = await import("./profiles");
    const ownUrl =
      "https://example.supabase.co/storage/v1/object/public/profile-images/user-1/avatar-123.jpg";
    const otherUserUrl =
      "https://example.supabase.co/storage/v1/object/public/profile-images/user-2/avatar-123.jpg";

    expect(getProfileAvatarStoragePath("user-1", ownUrl)).toBe("user-1/avatar-123.jpg");
    expect(isCustomProfileAvatarUrl("user-1", ownUrl)).toBe(true);
    expect(getProfileAvatarStoragePath("user-1", otherUserUrl)).toBeNull();
    expect(isCustomProfileAvatarUrl("user-1", "/profile-avatars/avatar-1.svg")).toBe(false);
  });
});
