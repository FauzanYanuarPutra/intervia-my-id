import type { SuperAppOrder, SuperAppTrustProfile, SupportTicket } from '@/lib/api';
import type { CrmListingRow, CrmUserRow } from './models';
export type AuthorizedContactSources={user:CrmUserRow;listings:CrmListingRow[];orders:SuperAppOrder[];tickets:SupportTicket[];trustProfile:SuperAppTrustProfile|null};
export type Contact360Model={user:CrmUserRow;listings:CrmListingRow[];orders:SuperAppOrder[];support:SupportTicket[];trust:SuperAppTrustProfile|null};
export function buildContact360(input:AuthorizedContactSources):Contact360Model{
  const id=input.user.id;
  return {user:input.user,listings:input.listings.filter(item=>item.ownerId===id),orders:input.orders.filter(order=>[order.requester_id,order.partner_id,order.merchant_id,order.provider_id].includes(id)),support:input.tickets.filter(ticket=>ticket.requester_user_id===id),trust:input.trustProfile?.user_id===id?input.trustProfile:null};
}
