        issue.includes('metadata.transferable_channels is required'),
      ),
    ).toBe(true);
  });
});


describe('canTransitionContentStatus', () => {
  it.each([
    ['published', 'active'],
    ['live', 'active'],
    ['published', 'published'],
    ['published', 'draft'],
    ['live', 'live'],
    ['live', 'draft'],
    ['ACTIVE', 'paused'],
    ['active', 'draft'],
  ])('allows %s -> %s as a normalized marketplace transition', (current, next) => {
    expect(canTransitionContentStatus(current, next)).toBe(true);
  });

  it('does not allow deleted content to be edited back into an active listing', () => {
    expect(canTransitionContentStatus('deleted', 'active')).toBe(false);
  });
});

describe('toUpsertListingPayload', () => {
  it('preserves pricing fields through the upsert contract', () => {