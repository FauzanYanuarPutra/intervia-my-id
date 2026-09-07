import { describe,expect,it } from 'vitest';
import { buildExploreFilterChanges,countExploreFilters } from './exploreFilters';
describe('Explore filter contract',()=>{
  it('counts only meaningful supported filters',()=>{
    expect(countExploreFilters({location:'',distanceKm:null,sort:'relevance'})).toBe(0);
    expect(countExploreFilters({location:'Bandung',distanceKm:10,sort:'latest'})).toBe(3);
  });
  it('serializes defaults as removals so URLs stay canonical',()=>{
    expect(buildExploreFilterChanges({location:'  Bandung  ',distanceKm:25,sort:'nearest'})).toEqual({location:'Bandung',distance:'25',sort:'nearest'});
    expect(buildExploreFilterChanges({location:' ',distanceKm:null,sort:'relevance'})).toEqual({location:null,distance:null,sort:null});
  });
});
