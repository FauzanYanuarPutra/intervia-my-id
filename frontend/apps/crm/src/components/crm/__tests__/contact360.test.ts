import { describe, expect, it } from 'vitest';
import { buildContact360 } from '../contact360';
const user={id:'u1',name:'Usaha A',handle:'@a',role:'Seller' as const,kyc:'Verified' as const,approvalStatus:'approved',manualHold:false,riskStrikes:0,transactions:1,gmvCents:100,lastActive:'2026-09-01',risk:'low' as const,city:'Bandung'};
describe('buildContact360',()=>{
  it('keeps missing authorized source data absent instead of synthesizing it',()=>{
    const result=buildContact360({user,listings:[],orders:[],tickets:[],trustProfile:null});
    expect(result.user.id).toBe('u1');
    expect(result.listings).toEqual([]);
    expect(result.orders).toEqual([]);
    expect(result.support).toEqual([]);
    expect(result.trust).toBeNull();
  });
  it('only includes records tied to the selected user',()=>{
    const result=buildContact360({
      user,
      listings:[{id:'l1',title:'Owned',category:'Jasa',priceCents:0,currency:'IDR',location:'Bandung',status:'active',rawStatus:'active',image:'',ownerId:'u1',featured:false,updatedAt:'',metadata:{},reportCount:0,reporters:[],reportReasons:[],reportTicketIds:[],moderationStatus:'normal'},{id:'l2',title:'Other',category:'Jasa',priceCents:0,currency:'IDR',location:'Jakarta',status:'active',rawStatus:'active',image:'',ownerId:'u2',featured:false,updatedAt:'',metadata:{},reportCount:0,reporters:[],reportReasons:[],reportTicketIds:[],moderationStatus:'normal'}],
      orders:[{id:'o1',requester_id:'u1',partner_id:'u2',merchant_id:null,provider_id:'u2',service_type:'service',status:'completed',payment_mode:'escrow',currency:'IDR',amount_estimate_cents:100,amount_final_cents:100,pickup_address:null,pickup_lat:null,pickup_lng:null,dropoff_address:null,dropoff_lat:null,dropoff_lng:null,risk_score:0,risk_flags:[],metadata:{},created_at:'',updated_at:''},{id:'o2',requester_id:'u3',partner_id:'u4',merchant_id:null,provider_id:'u4',service_type:'service',status:'completed',payment_mode:'escrow',currency:'IDR',amount_estimate_cents:100,amount_final_cents:100,pickup_address:null,pickup_lat:null,pickup_lng:null,dropoff_address:null,dropoff_lat:null,dropoff_lng:null,risk_score:0,risk_flags:[],metadata:{},created_at:'',updated_at:''}],
      tickets:[],trustProfile:null
    });
    expect(result.listings.map(x=>x.id)).toEqual(['l1']);
    expect(result.orders.map(x=>x.id)).toEqual(['o1']);
  });
});
