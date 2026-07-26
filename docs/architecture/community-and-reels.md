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
- Group identity media: avatar/photo and cover image, managed by group owner/moderator through the existing group permissions surface.
- Group management: owner/moderator can edit group name, description, privacy, posting/join permissions, rules, and moderate members with an audit reason for removal/block actions.
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
- Reels Studio can create media from camera, device upload, or a direct browser-playable HTTPS video URL such as MP4/WebM/MOV/M4V. External hosted video is stored as `media_url`/`video_src`; source provenance is kept in metadata.
- Viewer state/actions/events.
- Comments.
- Store metadata fields exist in community service code.

## Product Position

Community and reels are engagement/distribution/trust layers. They should help users discover needs, listings, profiles, and sellers, but they are not primary transaction categories.

## Risks

- Moderation must be explicit for posts, comments, reels, and media.
- Reels/profile/listing linkage may be partial and should be checked before promising conversion flows.
- Group permissions need UX and security review before broader rollout.
