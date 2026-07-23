import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

import { saveCompletionRecord } from "./completionRecords";

describe("saveCompletionRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.from.mockReset();
    mocks.storageFrom.mockReset();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(callback) {
      callback(new Blob(["optimized"], { type: "image/jpeg" }));
    });
  });

  it("uploads one photo and stores the user-entered climb date", async () => {
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/completion.jpg" } })),
      remove: vi.fn(),
    };
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "completion-1",
        mountain_id: "0000000002",
        completed_at: "2026-07-23T00:00:00.000Z",
        climbed_on: "2026-05-24",
        photo_url: "https://example.com/completion.jpg",
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    mocks.storageFrom.mockReturnValue(storage);
    mocks.from.mockReturnValue({ upsert });
    const photoFile = new File(["photo"], "summit.jpg", { type: "image/jpeg" });

    const record = await saveCompletionRecord({
      userId: "user-1",
      mountainId: "0000000002",
      climbedOn: "2026-05-24",
      photoFile,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        mountain_id: "0000000002",
        climbed_on: "2026-05-24",
        photo_url: "https://example.com/completion.jpg",
      }),
      { onConflict: "user_id,mountain_id" },
    );
    expect(record).toMatchObject({ climbedOn: "2026-05-24", photoUrl: "https://example.com/completion.jpg" });
  });

  it("stores a completion without uploading when no photo is selected", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "completion-2",
        mountain_id: "0000000003",
        completed_at: "2026-07-24T00:00:00.000Z",
        climbed_on: "2026-07-20",
        photo_url: null,
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ upsert });

    const record = await saveCompletionRecord({
      userId: "user-1",
      mountainId: "0000000003",
      climbedOn: "2026-07-20",
      photoFile: null,
    });

    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ photo_url: null }),
      { onConflict: "user_id,mountain_id" },
    );
    expect(record.photoUrl).toBeNull();
  });

  it("removes the uploaded photo when the database write fails", async () => {
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/completion.jpg" } })),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    mocks.storageFrom.mockReturnValue(storage);
    mocks.from.mockReturnValue({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("write failed") }),
        })),
      })),
    });

    await expect(saveCompletionRecord({
      userId: "user-1",
      mountainId: "0000000002",
      climbedOn: "2026-05-24",
      photoFile: new File(["photo"], "summit.jpg", { type: "image/jpeg" }),
    })).rejects.toThrow("write failed");

    expect(storage.remove).toHaveBeenCalledWith([expect.stringContaining("user-1/0000000002/")]);
  });
});
