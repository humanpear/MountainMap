import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MOUNTAINS_PATH = 'src/data/mountains.ts';
const ACTIVE_GUIDES_PATH = 'src/data/mountainGuides.ts';
const DRAFT_GUIDES_PATH = 'src/data/draftMountainGuides.ts';

function readText(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

function parseMountains() {
  const content = readText(MOUNTAINS_PATH);
  const directExportMatch = content.match(
    /export const mountains: Mountain\[\] = (\[[\s\S]*\]);\s*$/,
  );
  const recordMatch = content.match(
    /const mountainRecords: Omit<Mountain, 'regionCodes'>\[\] = ([\s\S]*?);\s*\n\s*export const mountains:/,
  );
  const serializedMountains = recordMatch?.[1] ?? directExportMatch?.[1];

  if (!serializedMountains) {
    throw new Error(`Could not parse ${MOUNTAINS_PATH}`);
  }

  return JSON.parse(serializedMountains);
}

function parseRecord(path, exportName) {
  const content = readText(path)
    .replace(/^import[^\n]*\n\n/, '')
    .replace(new RegExp(`export const ${exportName}: Record<string, MountainGuide> =`), 'return')
    .replace(/;\s*$/, ';');

  return Function(content)();
}

function hasForestTripCourseMapImage(route) {
  return (
    route.courseMapImage?.src?.includes('foresttrip.go.kr') ||
    route.courseMapImage?.sourceUrl?.includes('foresttrip.go.kr')
  );
}

function hasGuideCourseMapImage(guide) {
  return Boolean(guide.courseMapImage?.src);
}

function hasForestTripGuideHeroImage(guide) {
  return (
    guide.heroImage?.src?.includes('foresttrip.go.kr') ||
    guide.heroImage?.sourceUrl?.includes('foresttrip.go.kr')
  );
}

function hasTrackField(route) {
  return Boolean(
    route.routeTrackUrl ||
      route.routeTrackSource ||
      route.routeTrackQuality ||
      route.mapPathCoordinates
  );
}

function auditGuideRoutes(guides, scope) {
  const violations = [];
  let routeCount = 0;
  let courseMapImageCount = 0;
  let heroImageCount = 0;

  for (const [mountainId, guide] of Object.entries(guides)) {
    if (hasForestTripGuideHeroImage(guide)) {
      violations.push(`${scope} ${mountainId}: uses 숲나들e URL as heroImage`);
    }
    if (guide.heroImage) {
      heroImageCount += 1;
      const localPath = join(process.cwd(), 'public', guide.heroImage.src.replace(/^\//, ''));
      if (!/^\/mountain-images\/\d{10}\/hero\.png$/.test(guide.heroImage.src)) {
        violations.push(`${scope} ${mountainId}: invalid heroImage path`);
      }
      if (!existsSync(localPath)) {
        violations.push(`${scope} ${mountainId}: missing local heroImage file`);
      }
    }
    if (hasGuideCourseMapImage(guide)) {
      courseMapImageCount += 1;
      if (!guide.courseMapImage.src.includes('foresttrip.go.kr')) {
        violations.push(`${scope} ${mountainId}: guide courseMapImage must use 숲나들e direct URL for this phase`);
      }
      if (!guide.courseMapImage.alt?.includes('코스 지도')) {
        violations.push(`${scope} ${mountainId}: guide courseMapImage alt should describe a 코스 지도`);
      }
    }

    for (const route of guide.routes ?? []) {
      routeCount += 1;

      if (!Array.isArray(route.sourceLinks) || route.sourceLinks.length === 0) {
        violations.push(`${scope} ${mountainId} ${route.name}: missing sourceLinks`);
      }
      if (!Array.isArray(route.warnings) || route.warnings.length === 0) {
        violations.push(`${scope} ${mountainId} ${route.name}: missing warnings`);
      }
      if (hasTrackField(route)) {
        violations.push(`${scope} ${mountainId} ${route.name}: has removed GeoJSON/Kakao course-map field`);
      }
      if (hasForestTripCourseMapImage(route)) {
        violations.push(`${mountainId} ${route.name}: uses 숲나들e URL as courseMapImage`);
      }
      if (route.courseMapImage) {
        courseMapImageCount += 1;
        const localPath = join(process.cwd(), 'public', route.courseMapImage.src.replace(/^\//, ''));
        if (!/^\/course-images\/\d{10}\/[-a-z0-9]+-map\.webp$/.test(route.courseMapImage.src)) {
          violations.push(`${scope} ${mountainId} ${route.name}: invalid courseMapImage path`);
        }
        if (!existsSync(localPath)) {
          violations.push(`${scope} ${mountainId} ${route.name}: missing local courseMapImage file`);
        }
      }
    }
  }

  return { routeCount, courseMapImageCount, heroImageCount, violations };
}

function main() {
  const mountains = parseMountains();
  const activeGuides = parseRecord(ACTIVE_GUIDES_PATH, 'mountainGuides');
  const draftGuides = parseRecord(DRAFT_GUIDES_PATH, 'draftMountainGuides');
  const activeIds = new Set(Object.keys(activeGuides));
  const draftIds = new Set(Object.keys(draftGuides));
  const missingActive = mountains.filter((mountain) => !activeIds.has(mountain.id));
  const draftOnly = mountains.filter((mountain) => draftIds.has(mountain.id) && !activeIds.has(mountain.id));
  const forestTextGuides = Object.values(activeGuides).filter((guide) => JSON.stringify(guide).includes('숲나들e'));
  const activeRouteAudit = auditGuideRoutes(activeGuides, 'active');
  const draftRouteAudit = auditGuideRoutes(draftGuides, 'draft');
  const policyViolations = [...activeRouteAudit.violations, ...draftRouteAudit.violations];

  const report = {
    totals: {
      mountains: mountains.length,
      activeGuides: activeIds.size,
      draftGuides: draftIds.size,
      missingActiveGuides: missingActive.length,
      draftOnlyGuides: draftOnly.length,
      activeRoutes: activeRouteAudit.routeCount,
      draftRoutes: draftRouteAudit.routeCount,
      activeCourseMapImages: activeRouteAudit.courseMapImageCount,
      draftCourseMapImages: draftRouteAudit.courseMapImageCount,
      activeHeroImages: activeRouteAudit.heroImageCount,
      draftHeroImages: draftRouteAudit.heroImageCount,
      activeGuidesWithForestTripText: forestTextGuides.length
    },
    missingActiveGuides: missingActive.map((mountain) => ({
      id: mountain.id,
      name: mountain.name
    })),
    draftOnlyGuides: draftOnly.map((mountain) => ({
      id: mountain.id,
      name: mountain.name
    })),
    policyViolations
  };

  console.log(JSON.stringify(report, null, 2));

  if (policyViolations.length > 0) {
    process.exitCode = 1;
  }
}

main();
