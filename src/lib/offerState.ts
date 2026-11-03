import type { Offer } from '@/types/db';

export type Tone = 'action' | 'waiting' | 'good' | 'closed';

/** How an offer looks from the signed-in user's side. */
export function describeOffer(o: Offer, me: string) {
  const iAmOfferer = o.from_user === me;
  const other = iAmOfferer ? o.to_profile : o.from_profile;
  const myItems = iAmOfferer ? o.offer_items.map((i) => i.listing) : [o.target];
  const theirItems = iAmOfferer ? [o.target] : o.offer_items.map((i) => i.listing);
  const awaitingMe = o.awaiting_user === me && (o.status === 'pending' || o.status === 'countered');
  const iConfirmed = iAmOfferer ? !!o.from_confirmed_at : !!o.to_confirmed_at;
  const theyConfirmed = iAmOfferer ? !!o.to_confirmed_at : !!o.from_confirmed_at;

  let label: string;
  let tone: Tone;
  switch (o.status) {
    case 'pending':
    case 'countered':
      if (awaitingMe) {
        label = o.status === 'countered' ? 'Counter-offer, your turn' : 'New offer, your turn';
        tone = 'action';
      } else {
        label = `Waiting for ${other.display_name}`;
        tone = 'waiting';
      }
      break;
    case 'accepted':
      label = iConfirmed ? `Waiting for ${other.display_name} to confirm` : 'Accepted, arrange the meetup';
      tone = iConfirmed ? 'waiting' : 'action';
      break;
    case 'completed':
      label = 'Swapped';
      tone = 'good';
      break;
    case 'declined':
      label = 'Declined';
      tone = 'closed';
      break;
    default:
      label = 'Cancelled';
      tone = 'closed';
  }
  const isOpen = o.status === 'pending' || o.status === 'countered' || o.status === 'accepted';
  return { iAmOfferer, other, myItems, theirItems, awaitingMe, iConfirmed, theyConfirmed, label, tone, isOpen };
}
