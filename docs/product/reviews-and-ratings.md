# Reviews And Ratings

Status: product guardrail for Lajukan reviews and ratings.

## Goal

Ratings should help Indonesian users judge whether a business, listing, or service is worth contacting. Ratings must not become a tool for spam, revenge, fake promotion, or unverifiable claims.

## Review Types

### Transaction-Verified Review

Use this when Lajukan can verify that a transaction happened in the platform.

Eligibility:

- Transaction status is `completed`.
- Reviewer is the buyer or seller on that transaction.
- One active review per reviewer per transaction.
- Reviewee is the other party, never the reviewer.

Public label:

- ID: `Transaksi terverifikasi`
- EN: `Verified transaction`

Best surfaces:

- Product listings.
- Service listings.
- Equipment or supply deals.
- UMKM orders when the order flow is complete.

### Experience Review

Use this only after a user has real interaction evidence, even if no Lajukan transaction exists yet.

Allowed signals:

- Chat conversation with the business.
- Request for quote or offer.
- Contact or WhatsApp click plus follow-up signal.
- Store visit/check-in when location signals are reliable.
- Uploaded evidence reviewed by moderation when disputed.

Public label:

- ID: `Ulasan pengalaman`
- EN: `Experience review`

Required caveat:

- ID: `Belum diverifikasi lewat transaksi Lajukan.`
- EN: `Not verified through a Lajukan transaction.`

Do not allow reviews from a profile view alone.

## Surfaces

- Business profile and business place: show both verified transaction rating and experience rating as separate rows.
- Product, service, equipment, and supplies listings: prioritize verified transaction rating.
- Community posts, comments, reels, and ordinary content: do not use star ratings. Use helpful, like, save, share, report, and not interested signals.
- Personal user profiles: show reputation signals such as completed transactions, response quality, and dispute history. Avoid personality ratings.

## Display Rule

Do not merge review types into one ambiguous score.

Preferred display:

```text
4.8 dari 87 ulasan
Transaksi terverifikasi 4.9 · 52 ulasan
Ulasan pengalaman       4.6 · 35 ulasan
```

If only one type exists, label it clearly.

## Safety Rules

- Verified phone or trusted account required before publishing a review.
- No self-review or review by owner, employee, agency, or clearly related account.
- No paid, discounted, coerced, or incentivized rating for a specific outcome.
- No threats, harassment, hate, private phone numbers, full addresses, payment data, or unrelated personal data.
- No competitor attack campaigns.
- One active review per eligible interaction.
- Keep edit history and moderation actions auditable.
- Provide report, owner reply, user appeal, and owner appeal paths.

## Data And Legal Guardrails

- Store the minimum personal data needed to verify eligibility and audit abuse.
- Do not expose private phone numbers, exact addresses, transaction evidence, or internal fraud signals in public reviews.
- Keep review evidence private by default and visible only to authorized moderation/support users.
- Treat review reports and appeals as auditable support/moderation records, not hard deletes.
- Personal data handling must follow Indonesian personal data protection obligations before public launch.

## Implementation Phases

### Phase 1

Keep public reviews limited to transaction-verified reviews.

Required:

- Completed transaction gate.
- Duplicate prevention.
- Rating range validation.
- Comment length limit.
- User attestation that the review is based on a real transaction and not incentivized.
- Clear `Transaksi terverifikasi` label in UI.

### Phase 2

Add experience reviews only after these are ready:

- Interaction eligibility table or event-derived eligibility.
- Conflict-of-interest detection.
- Review report API.
- Moderation queue integration.
- Owner reply.
- Appeal flow.
- Public split between verified transaction and experience rating.

### Phase 3

Use review signals in search/ranking carefully.

Rules:

- Verified transaction reviews have higher trust weight.
- Experience reviews can influence discovery but must not override relevance, location, or verified business quality.
- Suspicious review bursts should lower trust until reviewed.
