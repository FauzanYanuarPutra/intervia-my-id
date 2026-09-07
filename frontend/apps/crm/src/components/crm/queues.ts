import type { SupportTicket } from '@/lib/api';
import type { CrmChatRow, CrmTransactionRow } from './models';
const time=(value:string)=>{const n=new Date(value).getTime();return Number.isFinite(n)?n:0};
export function rankConversations(items:CrmChatRow[]):CrmChatRow[]{return [...items].sort((a,b)=>((b.unread>0?4:0)+(b.stage==='Hot'?3:b.stage==='Warm'?1:0))-((a.unread>0?4:0)+(a.stage==='Hot'?3:a.stage==='Warm'?1:0))||time(b.updatedAt)-time(a.updatedAt)||a.id.localeCompare(b.id))}
export function rankSupportTickets(items:SupportTicket[]):SupportTicket[]{const score=(x:SupportTicket)=>(x.priority==='urgent'?5:x.priority==='high'?4:0)+(['open','in_progress','pending_customer'].includes(x.status)?2:0)+(x.category==='dispute'?2:0);return [...items].sort((a,b)=>score(b)-score(a)||time(b.updated_at)-time(a.updated_at)||a.id.localeCompare(b.id))}
export function rankRiskTransactions(items:CrmTransactionRow[]):CrmTransactionRow[]{const score=(x:CrmTransactionRow)=>(x.status==='disputed'?100:0)+x.riskScore;return [...items].sort((a,b)=>score(b)-score(a)||time(b.updatedAt)-time(a.updatedAt)||a.id.localeCompare(b.id))}
