import { describe,expect,it } from 'vitest';
import { firstParam,hasExploreResultState,retainedCategorySearch } from './searchState';
describe('Explore search state',()=>{
  it('normalizes the first meaningful query value',()=>expect(firstParam([' ',' mesin ','alat'])).toBe('mesin'));
  it('keeps the default hub as hub',()=>{
    expect(hasExploreResultState({})).toBe(false);
    expect(hasExploreResultState({tab:'all',sort:'relevance',side:'supply'})).toBe(false);
    expect(hasExploreResultState({q:'a'})).toBe(false);
  });
  it('recognizes meaningful result modes',()=>{
    expect(hasExploreResultState({q:'mesin'})).toBe(true);
    expect(hasExploreResultState({tab:'products'})).toBe(true);
    expect(hasExploreResultState({side:'demand'})).toBe(true);
    expect(hasExploreResultState({location:'Bandung'})).toBe(true);
  });
  it('retains only meaningful category redirect state',()=>{
    expect(retainedCategorySearch({category:'mesin-alat',q:' blender ',tab:'all',sort:'relevance',location:'Bandung',cursor:'abc',junk:'x'})).toBe('?q=blender&location=Bandung&cursor=abc');
  });
});
