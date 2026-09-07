import { describe, expect, it } from 'vitest';
import { rankConversations, rankRiskTransactions, rankSupportTickets } from '../queues';
describe('CRM operational queues',()=>{
  it('ranks unread hot conversations first without inventing messages',()=>{
    const ranked=rankConversations([
      {id:'a',name:'A',lastMessage:'real-a',stage:'Warm',source:'chat',listingTitle:'L',updatedAt:'2026-09-01',unread:0},
      {id:'b',name:'B',lastMessage:'real-b',stage:'Hot',source:'chat',listingTitle:'L',updatedAt:'2026-09-02',unread:1},
    ]);
    expect(ranked.map(x=>x.id)).toEqual(['b','a']);
    expect(ranked[0].lastMessage).toBe('real-b');
  });
  it('ranks urgent support before normal support',()=>{
    const base={requester_user_id:'u',requester_email:'u@example.com',requester_name:'U',category:'support',subject:'S',status:'open',assigned_agent_id:null,support_room_id:null,source:'support',created_at:'2026-09-01',updated_at:'2026-09-01',resolved_at:null,first_response_at:null,latest_message:null,latest_message_at:null};
    const ranked=rankSupportTickets([{...base,id:'n',priority:'normal'},{...base,id:'u',priority:'urgent'}]);
    expect(ranked.map(x=>x.id)).toEqual(['u','n']);
  });
  it('ranks disputed/high-risk transactions first',()=>{
    const ranked=rankRiskTransactions([
      {id:'a',buyer:'1',seller:'2',amountCents:1,status:'completed',serviceType:'x',riskScore:10,updatedAt:'2026-09-02'},
      {id:'b',buyer:'1',seller:'2',amountCents:1,status:'disputed',serviceType:'x',riskScore:80,updatedAt:'2026-09-01'},
    ]);
    expect(ranked.map(x=>x.id)).toEqual(['b','a']);
  });
});
