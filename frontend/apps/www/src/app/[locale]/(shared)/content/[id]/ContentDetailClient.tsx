
  const meta = (item.metadata as Record<string, unknown> | null) || {};
  const publicReference = readPublicReference(item as CatalogContentItem);
  const localeCode = locale === 'id' ? 'id' : 'en';
  // Ownership UI must use the same canonical owner identity as the server.
  // Do not infer ownership from seller/contact/user metadata that can refer to
  // another participant in the listing.
  const ownerCandidateIds = [
    item.owner_id,
    item.owner_profile?.id,
    typeof meta.owner_id === 'string' ? meta.owner_id : null,
    typeof meta.owner_profile_id === 'string' ? meta.owner_profile_id : null,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .map(value => value.trim());
  const peerUserId =
    ownerCandidateIds.find(value => isUuidLike(value)) ||
    ownerCandidateIds[0] ||
    '';
  const viewerId = String(user?.id || '').trim().toLowerCase();
  const normalizedPeerUserId = peerUserId.trim().toLowerCase();
  const isOwner =
    Boolean(viewerId) &&
    Boolean(normalizedPeerUserId) &&
    viewerId === normalizedPeerUserId;
  const isSelfPeer = isOwner;