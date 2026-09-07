import { describe, expect, it } from 'vitest';
import { shouldQueryUsernameSuggestions } from './InviteMemberQuickForm';

describe('shouldQueryUsernameSuggestions', () => {
  it('does not query for short usernames', () => {
    expect(shouldQueryUsernameSuggestions('a', null)).toBe(false);
  });

  it('does not query when the selected user still matches the input', () => {
    expect(
      shouldQueryUsernameSuggestions('fauzan', {
        id: 'user-1',
        username: 'Fauzan',
        fullName: 'Muhammad Fauzan',
      }),
    ).toBe(false);
  });

  it('queries when a searchable username is not the selected user', () => {
    expect(
      shouldQueryUsernameSuggestions('fauzan', {
        id: 'user-1',
        username: 'another-user',
        fullName: 'Another User',
      }),
    ).toBe(true);
  });
});
