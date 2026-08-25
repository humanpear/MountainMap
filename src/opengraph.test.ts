import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectPath = (...segments: string[]) => resolve(process.cwd(), ...segments);

describe("Open Graph metadata", () => {
  const html = readFileSync(projectPath("index.html"), "utf8");
  const document = new DOMParser().parseFromString(html, "text/html");

  const propertyContent = (property: string) =>
    document.querySelector(`meta[property="${property}"]`)?.getAttribute("content");

  const namedContent = (name: string) =>
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");

  it("publishes the Bongmoa social-sharing contract", () => {
    expect(document.title).toBe("봉우리모아 | 대한민국 100대 명산을 한곳에");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://bongmoa.com/",
    );
    expect(propertyContent("og:type")).toBe("website");
    expect(propertyContent("og:locale")).toBe("ko_KR");
    expect(propertyContent("og:site_name")).toBe("봉우리모아");
    expect(propertyContent("og:title")).toBe("봉우리모아 | 대한민국 100대 명산을 한곳에");
    expect(propertyContent("og:url")).toBe("https://bongmoa.com/");
    expect(propertyContent("og:image")).toBe("https://bongmoa.com/opengraph.png");
    expect(propertyContent("og:image:secure_url")).toBe("https://bongmoa.com/opengraph.png");
    expect(propertyContent("og:image:type")).toBe("image/png");
    expect(propertyContent("og:image:width")).toBe("1731");
    expect(propertyContent("og:image:height")).toBe("909");
    expect(propertyContent("og:image:alt")).toBeTruthy();
  });

  it("uses the same image for the X large-image card", () => {
    expect(namedContent("twitter:card")).toBe("summary_large_image");
    expect(namedContent("twitter:title")).toBe("봉우리모아 | 대한민국 100대 명산을 한곳에");
    expect(namedContent("twitter:image")).toBe("https://bongmoa.com/opengraph.png");
    expect(namedContent("twitter:image:alt")).toBeTruthy();
  });

  it("ships the declared PNG dimensions", () => {
    const image = readFileSync(projectPath("public", "opengraph.png"));

    expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(1731);
    expect(image.readUInt32BE(20)).toBe(909);
  });
});
