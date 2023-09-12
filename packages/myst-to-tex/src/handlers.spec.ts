import { describe, expect, it } from 'vitest';
import { CaptionKind, determineCaptionKind } from './container';

describe('handlers tests', () => {
  describe('glossary', () => {
    it('some', () => {
      const node = {
        type: 'iframe',
      };
      expect(determineCaptionKind(node)).toEqual(CaptionKind.fig);
    });
  });
});
