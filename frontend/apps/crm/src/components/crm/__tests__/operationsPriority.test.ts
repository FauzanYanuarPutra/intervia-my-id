import { describe,expect,it } from 'vitest';
import { buildOperationsPriorities } from '../operationsPriority';
describe('CRM operations priority',()=>{
  it('orders urgent real work without fabricated counts',()=>{
    const items=buildOperationsPriorities({
      leads:[{stage:'lead'},{stage:'won'}],
      tickets:[{status:'open'},{status:'resolved'}],
      orders:[{status:'disputed',risk_score:80},{status:'completed',risk_score:10}],
      chats:[{unread:3},{unread:0}],
      users:[{kyc:'Pending',risk:'low',manualHold:false},{kyc:'Verified',risk:'high',manualHold:true}],
      listings:[{reportCount:2},{reportCount:0}],
    });
    expect(items.map(item=>[item.kind,item.count])).toEqual([
      ['risk',2],['conversations',3],['support',1],['users',1],['listings',1],['pipeline',1],
    ]);
  });
  it('returns no fake tasks when everything is clear',()=>expect(buildOperationsPriorities({leads:[],tickets:[],orders:[],chats:[],users:[],listings:[]})).toEqual([]));
});
