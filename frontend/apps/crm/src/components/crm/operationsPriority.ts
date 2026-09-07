export type OperationsDestination='pipeline'|'users'|'listings'|'transactions'|'chat'|'disputes';
export type OperationsPriority={kind:'risk'|'conversations'|'support'|'users'|'listings'|'pipeline';label:string;description:string;count:number;destination:OperationsDestination;priority:number};
type Inputs={leads:Array<{stage?:string}>;tickets:Array<{status?:string}>;orders:Array<{status?:string;risk_score?:number}>;chats:Array<{unread?:number}>;users:Array<{kyc?:string;risk?:string;manualHold?:boolean}>;listings:Array<{reportCount?:number}>};
export function buildOperationsPriorities(input:Inputs):OperationsPriority[]{
  const highRiskOrders=input.orders.filter(item=>(item.risk_score??0)>=70||item.status==='disputed').length;
  const heldOrHighRiskUsers=input.users.filter(item=>item.manualHold||item.risk==='high').length;
  const unread=input.chats.reduce((sum,item)=>sum+Math.max(0,item.unread??0),0);
  const openTickets=input.tickets.filter(item=>['open','in_progress','pending_customer'].includes(item.status??'')).length;
  const pendingKyc=input.users.filter(item=>item.kyc==='Pending').length;
  const reportedListings=input.listings.filter(item=>(item.reportCount??0)>0).length;
  const openLeads=input.leads.filter(item=>!['won','lost','closed'].includes((item.stage??'').toLowerCase())).length;
  const items:OperationsPriority[]=[
    {kind:'risk',label:'Risiko & dispute',description:'Order berisiko tinggi atau user yang sedang ditahan/review.',count:highRiskOrders+heldOrHighRiskUsers,destination:'disputes',priority:100},
    {kind:'conversations',label:'Percakapan belum dibaca',description:'Pesan prospek atau support yang menunggu respons.',count:unread,destination:'chat',priority:90},
    {kind:'support',label:'Support terbuka',description:'Tiket aktif yang masih perlu tindak lanjut.',count:openTickets,destination:'disputes',priority:80},
    {kind:'users',label:'KYC perlu review',description:'User dengan status KYC pending.',count:pendingKyc,destination:'users',priority:70},
    {kind:'listings',label:'Listing dilaporkan',description:'Listing dengan laporan yang perlu keputusan moderasi.',count:reportedListings,destination:'listings',priority:60},
    {kind:'pipeline',label:'Lead aktif',description:'Lead yang belum masuk tahap selesai.',count:openLeads,destination:'pipeline',priority:50},
  ];
  return items.filter(item=>item.count>0).sort((a,b)=>b.priority-a.priority);
}
