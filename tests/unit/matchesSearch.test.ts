import { describe, expect, it } from 'vitest';
import { matchesSearch } from '@/app/projects/matchesSearch';

const project = { name: 'Õie tänav 5', client: 'Mari Tamm', address: 'Tartu mnt 12, Tallinn' };

describe('matchesSearch', () => {
  it('matches everything when the search is empty or blank', () => {
    expect(matchesSearch(project, '')).toBe(true);
    expect(matchesSearch(project, '   ')).toBe(true);
  });

  it('ignores case and accents', () => {
    expect(matchesSearch(project, 'oie')).toBe(true);
    expect(matchesSearch(project, 'ÕIE TÄNAV')).toBe(true);
    expect(matchesSearch(project, 'tanav')).toBe(true);
  });

  it('searches the client and the address too', () => {
    expect(matchesSearch(project, 'tamm')).toBe(true);
    expect(matchesSearch(project, 'tallinn')).toBe(true);
  });

  it('handles missing client and address', () => {
    expect(matchesSearch({ name: 'Köök', client: null, address: null }, 'kook')).toBe(true);
    expect(matchesSearch({ name: 'Köök', client: null, address: null }, 'tamm')).toBe(false);
  });

  it('returns false when nothing matches', () => {
    expect(matchesSearch(project, 'vannituba')).toBe(false);
  });
});
