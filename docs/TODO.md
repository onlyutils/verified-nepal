# TODO

## Organizations fulfilling a person's need
Today only a moderator or admin can mark a need fulfilled (claim-code redeem or the moderation status
endpoint), and only individuals can claim group items. Nothing links an organization to a beneficiary's
need. Planned: an `orgId` on a claim / group item plus a member-only "fulfil on behalf of org" route
reusing the existing redeem or group-item-done logic. Once shipped, extend `storyRole` in
`server/src/models/story.js` so an org that fulfilled a need counts as "org" for stories.
