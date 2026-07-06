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

  it("recognizes unique nickname conflicts from Supabase errors", async () => {
    const { isDisplayNameConflictError } = await import("./profiles");

    expect(isDisplayNameConflictError({ code: "23505", message: "duplicate key value" })).toBe(true);
    expect(
      isDisplayNameConflictError({
        code: "400",
        message: 'duplicate key violates "profiles_display_name_normalized_key"',
      }),
    ).toBe(true);
    expect(isDisplayNameConflictError({ code: "42703", message: "missing column" })).toBe(false);
  });
});
