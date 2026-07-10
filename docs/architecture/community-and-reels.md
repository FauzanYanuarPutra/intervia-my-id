# Community And Reels

Status: repo audit 2026-07-11.

## Community/Forum

Evidence:

- Frontend: `/community`, `/community/groups/[slug]`.
- BFF routes: `/api/community/*`, `/api/forum/*`.
- Backend routes: community `/v1/community/*`, `/v1/forum/*`.
- DB: forum categories, users, tags, threads, thread tags, posts, votes, audit logs; groups and group members.

Implemented concepts:

- Community feed/search.
- Groups, members, join/leave, permissions.
- Forum overview/search/tags/categories.
- Threads/posts/votes/polls/solution.
- Media upload/media serving.

## Reels

Evidence:

- Frontend: `/reels`, `ReelsClient`.
- BFF routes: `/api/reels/*`.
- Backend routes: `/v1/reels`, feed, detail, viewer state, actions, events, comments.
- DB: reels, reel events, reel comments, reel user actions.

Implemented concepts:

- Reel listing/feed.
- Create/update/delete.
- Viewer state/actions/events.
- Comments.
- Store metadata fields exist in community service code.

## Product Position

Community and reels are engagement/distribution/trust layers. They should help users discover needs, listings, profiles, and sellers, but they are not primary transaction categories.

## Risks

- Moderation must be explicit for posts, comments, reels, and media.
- Reels/profile/listing linkage may be partial and should be checked before promising conversion flows.
- Group permissions need UX and security review before broader rollout.
