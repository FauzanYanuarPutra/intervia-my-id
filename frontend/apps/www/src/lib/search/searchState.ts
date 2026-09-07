export type ExploreSearchParams=Record<string,string|string[]|undefined>;
const EXPLORE_RESULT_PARAMS=new Set(['q','side','tab','type','category','subcategory','location','lat','lng','distance','sort','min_price','max_price','condition','service_mode','verified','status','privacy','cursor']);
const RETAINED_CATEGORY_PARAMS=['q','side','tab','subcategory','location','lat','lng','distance','sort','min_price','max_price','condition','service_mode','verified','status','privacy','cursor'] as const;
const RESULT_TABS=new Set(['products','services','businesses','needs','users','references']);
export function firstParam(value:string|string[]|undefined):string{if(Array.isArray(value))return value.find(item=>item.trim().length>0)?.trim()||'';return value?.trim()||''}
function hasMeaningfulExploreValue(key:string,value:string):boolean{if(!value)return false;switch(key){case'q':return value.length>=2;case'sort':return value!=='relevance';case'tab':return RESULT_TABS.has(value);case'side':return value==='demand';case'category':return false;case'cursor':return value.length>0;default:return true}}
export function hasExploreResultState(searchParams:ExploreSearchParams):boolean{
  if(firstParam(searchParams.q).length>=2)return true;
  if(RESULT_TABS.has(firstParam(searchParams.tab)))return true;
  if(firstParam(searchParams.side)==='demand')return true;
  for(const [key,rawValue] of Object.entries(searchParams)){if(!EXPLORE_RESULT_PARAMS.has(key)||key==='q'||key==='tab'||key==='side')continue;if(hasMeaningfulExploreValue(key,firstParam(rawValue)))return true}
  return false;
}
export function retainedCategorySearch(input:ExploreSearchParams):string{
  const output=new URLSearchParams();
  for(const key of RETAINED_CATEGORY_PARAMS){const value=firstParam(input[key]);if(!value)continue;if(key==='q'&&value.length<2)continue;if(key==='sort'&&value==='relevance')continue;if(key==='tab'&&value==='all')continue;if(key==='side'&&value==='supply')continue;output.set(key,value)}
  const query=output.toString();return query?`?${query}`:'';
}
