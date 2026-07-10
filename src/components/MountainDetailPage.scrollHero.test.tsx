import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountains } from "../data/mountains";
import { MountainDetailPage } from "./MountainDetailPage";

vi.mock("../services/mountainWeather", () => ({
  fetchMountainWeather: vi.fn(async () => null),
  getMountainWeatherPageUrl: vi.fn(() => undefined),
  getMountainWeatherStationForName: vi.fn(() => undefined),
}));

describe("MountainDetailPage scroll-reactive hero", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the desktop hero image and content together while the page scrolls", async () => {
    const mountain = mountains[0];
    const { container } = render(
      <MountainDetailPage
        mountain={mountain}
        isCompleted={false}
        onBack={vi.fn()}
        onShowOnMap={vi.fn()}
        onToggleCompleted={vi.fn()}
      />,
    );

    const section = container.querySelector(
      `section[aria-label="${mountain.name} 상세 정보"]`,
    ) as HTMLElement;
    const header = section.querySelector("header") as HTMLElement;
    const heroFrame = header.querySelector(
      "[data-scroll-hero-frame]",
    ) as HTMLElement;
    const heroContent = header.querySelector(
      "[data-scroll-hero-content]",
    ) as HTMLElement;
    const image = heroFrame.querySelector("img") as HTMLImageElement;
    let sectionTop = 0;
    vi.spyOn(section, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          bottom: sectionTop + 1200,
          height: 1200,
          left: 0,
          right: 1200,
          top: sectionTop,
          width: 1200,
          x: 0,
          y: sectionTop,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    expect(section.className).not.toContain("overflow-auto");
    expect(section.className).toContain("min-h-[calc(100vh-68px)]");
    expect(header.className).not.toContain("overflow-hidden");
    expect(heroFrame.className).not.toContain("sticky");
    expect(heroFrame.className).toContain("relative");
    expect(heroFrame.className).toContain("overflow-hidden");
    expect(heroFrame.className).toContain("items-end");
    expect(heroContent.style.transform).toBe("");
    expect(image.className).toContain("w-full");
    expect(image.className).not.toContain("object-contain");
    expect(header.style.height).toBe("675px");
    expect(heroFrame.style.height).toBe("var(--hero-frame-height)");
    expect(header.style.getPropertyValue("--hero-frame-height")).toBe("675px");
    expect(header.style.getPropertyValue("--hero-image-brightness")).toBe(
      "0.900",
    );
    expect(header.style.getPropertyValue("--hero-image-opacity")).toBe("1.000");

    await act(async () => {
      sectionTop = -120;
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(header.style.height).toBe("675px");
    expect(header.style.getPropertyValue("--hero-frame-height")).toBe("675px");
    expect(header.style.getPropertyValue("--hero-sticky-offset")).toBe("0px");
    expect(header.style.getPropertyValue("--hero-image-brightness")).toBe(
      "0.727",
    );
    expect(header.style.getPropertyValue("--hero-image-opacity")).toBe("1.000");

    await act(async () => {
      sectionTop = -360;
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(header.style.height).toBe("675px");
    expect(header.style.getPropertyValue("--hero-frame-height")).toBe("675px");
    expect(header.style.getPropertyValue("--hero-sticky-offset")).toBe("0px");
    expect(header.style.getPropertyValue("--hero-image-brightness")).toBe(
      "0.381",
    );
    expect(header.style.getPropertyValue("--hero-image-opacity")).toBe("1.000");

    await act(async () => {
      sectionTop = 0;
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(header.style.height).toBe("675px");
    expect(header.style.getPropertyValue("--hero-frame-height")).toBe("675px");
    expect(header.style.getPropertyValue("--hero-sticky-offset")).toBe("0px");
    expect(header.style.getPropertyValue("--hero-image-brightness")).toBe(
      "0.900",
    );
    expect(header.style.getPropertyValue("--hero-image-opacity")).toBe("1.000");
  });
});
