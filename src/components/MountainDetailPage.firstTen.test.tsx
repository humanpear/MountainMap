import { cleanup, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getMountainMainHeroImage, MountainDetailPage } from './MountainDetailPage';
import { mountains } from '../data/mountains';
import { forestTripOfficialSelections } from '../data/forestTripOfficialSelections';

describe('MountainDetailPage mountain guides', () => {
  it('renders review-ready header, official source and foresttrip course map/table for every mountain', () => {
    for (const mountain of mountains) {
      const { container } = render(
        <MountainDetailPage
          mountain={mountain}
          isCompleted={false}
          isCompletionPending={false}
          onBack={() => undefined}
          onShowOnMap={() => undefined}
          onRequestCompletion={() => undefined}
        />
      );

      const text = container.textContent ?? '';
      const officialUrl = forestTripOfficialSelections[mountain.id]?.url;
      const hasOfficialLink = officialUrl
        ? Array.from(container.querySelectorAll('a')).some((link) => link.getAttribute('href') === officialUrl)
        : false;
      expect(text, mountain.name).toContain(mountain.name);
      expect(text, mountain.name).toContain('산 정보');
      expect(text, mountain.name).toContain('숲나들e');
      expect(hasOfficialLink, mountain.name).toBe(true);
      expect(text, mountain.name).toContain('추천 코스');
      expect(text, mountain.name).toContain('추천 코스 지도');
      expect(text, mountain.name).toContain('추천 코스 정보');
      expect(text, mountain.name).not.toContain('코스 상세보기');

      cleanup();
    }
  }, 20000);

  it('uses local default hero images for the main mountain header', () => {
    for (const mountainId of ['0000000002', '0000000003']) {
      const mountain = mountains.find((candidate) => candidate.id === mountainId);
      expect(mountain).toBeDefined();

      const { container } = render(
        <MountainDetailPage
          mountain={mountain!}
          isCompleted={false}
          isCompletionPending={false}
          onBack={() => undefined}
          onShowOnMap={() => undefined}
          onRequestCompletion={() => undefined}
        />
      );

      expect(container.querySelector('header')?.getAttribute('style'), mountain!.name).toContain(
        `/mountain-images/${mountainId}/hero.png`
      );

      cleanup();
    }
  });

  it('prefers an explicit guide hero image over the local default path', () => {
    expect(
      getMountainMainHeroImage('0000000002', {
        src: '/custom/gari-hero.png',
        alt: '가리산 대표 이미지'
      })
    ).toBe('/custom/gari-hero.png');
  });
});
