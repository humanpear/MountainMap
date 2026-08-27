import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { from: mocks.from },
}));

const user = {
  id: "user-1",
  email: "google.person@example.com",
  user_metadata: { full_name: "구글 사용자" },
} as unknown as User;

beforeEach(() => {
  mocks.from.mockReset();
  vi.restoreAllMocks();
});

describe("profile helpers", () => {
  it("normalizes display names for duplicate checks", async () => {
    const { normalizeDisplayName, sanitizeDisplayName } = await import("./profiles");

    expect(sanitizeDisplayName("  산   친구  ")).toBe("산 친구");
    expect(normalizeDisplayName("  Trail   USER  ")).toBe("trail user");
  });

  it("creates default display names from the curated phrases and four digits", async () => {
    const { createDefaultDisplayName, defaultDisplayNamePhrases } = await import("./profiles");
    const randomValues = [0, 0.4827];

    expect(defaultDisplayNamePhrases).toHaveLength(24);
    expect(new Set(defaultDisplayNamePhrases).size).toBe(24);
    expect(createDefaultDisplayName(() => randomValues.shift() ?? 0)).toBe("푸른능선4827");
    expect(createDefaultDisplayName(() => 1)).toBe("먼산메아리9999");
    expect(createDefaultDisplayName(() => -1)).toBe("푸른능선0000");
    expect(defaultDisplayNamePhrases.every((phrase) => `${phrase}0000`.length <= 20)).toBe(true);
  });

  it("stores a generated nickname for a new profile without Google identity data", async () => {
    const insertedRow = {
      id: user.id,
      email: user.email,
      display_name: "푸른능선4827",
      display_name_normalized: "푸른능선4827",
      avatar_url: "/profile-avatars/avatar-1.svg",
      avatar_kind: "default-1",
      updated_at: null,
    };
    const firstMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertSingle = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    mocks.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: firstMaybeSingle })),
        })),
      })
      .mockReturnValueOnce({ insert });
    const randomValues = [0, 0.4827];
    vi.spyOn(Math, "random").mockImplementation(() => randomValues.shift() ?? 0);
    const { fetchOrCreateUserProfile } = await import("./profiles");

    const profile = await fetchOrCreateUserProfile(user);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      display_name: "푸른능선4827",
      display_name_normalized: "푸른능선4827",
    }));
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ display_name: "구글 사용자" }));
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ display_name: "google.person" }));
    expect(profile.displayName).toBe("푸른능선4827");
  });

  it("returns the stored profile when another request wins the creation race", async () => {
    const concurrentRow = {
      id: user.id,
      email: user.email,
      display_name: "고요한산길1357",
      display_name_normalized: "고요한산길1357",
      avatar_url: "/profile-avatars/avatar-1.svg",
      avatar_kind: "default-1",
      updated_at: null,
    };
    const initialMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const conflictSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const retryMaybeSingle = vi.fn().mockResolvedValue({ data: concurrentRow, error: null });
    mocks.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: initialMaybeSingle })),
        })),
      })
      .mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: conflictSingle })),
        })),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: retryMaybeSingle })),
        })),
      });
    const { fetchOrCreateUserProfile } = await import("./profiles");

    await expect(fetchOrCreateUserProfile(user)).resolves.toMatchObject({
      displayName: "고요한산길1357",
    });
  });

  it("keeps an existing profile without inserting a new nickname", async () => {
    const existingRow = {
      id: user.id,
      email: user.email,
      display_name: "기존산친구",
      display_name_normalized: "기존산친구",
      avatar_url: "/profile-avatars/avatar-2.svg",
      avatar_kind: "default-2",
      updated_at: null,
    };
    const insert = vi.fn();
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
        })),
      })),
      insert,
    });
    const { fetchOrCreateUserProfile } = await import("./profiles");

    await expect(fetchOrCreateUserProfile(user)).resolves.toMatchObject({ displayName: "기존산친구" });
    expect(insert).not.toHaveBeenCalled();
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
