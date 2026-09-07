import type { GlobalSearchSort } from './globalSearch';
export type ExploreFilterState={location:string;distanceKm:number|null;sort:GlobalSearchSort};
export function countExploreFilters(state:ExploreFilterState):number{
  return Number(Boolean(state.location.trim()))+Number(state.distanceKm!==null)+Number(state.sort!=='relevance');
}
export function buildExploreFilterChanges(state:ExploreFilterState):Record<string,string|null>{
  const location=state.location.replace(/\s+/g,' ').trim();
  return {location:location||null,distance:state.distanceKm===null?null:String(state.distanceKm),sort:state.sort==='relevance'?null:state.sort};
}
