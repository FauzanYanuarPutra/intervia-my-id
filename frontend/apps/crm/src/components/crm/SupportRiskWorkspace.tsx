import type { SupportTicket } from '@/lib/api';
import type { CrmTransactionRow, CrmUserRow } from './models';
import { SupportWorkspace } from './SupportWorkspace';
import { RiskWorkspace } from './RiskWorkspace';
export function SupportRiskWorkspace(props:{tickets:SupportTicket[];transactions:CrmTransactionRow[];users:CrmUserRow[];supportFailed?:boolean}){return <div className="space-y-8"><SupportWorkspace tickets={props.tickets} failed={props.supportFailed}/><RiskWorkspace transactions={props.transactions} users={props.users}/></div>}
