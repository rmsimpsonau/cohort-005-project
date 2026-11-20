# Research: hosted in-app notification services

Answers issue #2 (part of #1). Researched 2026-11-20. Primary sources only (vendor pricing pages and official docs); each claim is linked to its source. Where a page did not state something, it is marked **Not stated** rather than guessed. Pricing pages change; re-check before committing.

Constraints from #1: hosted SaaS, free tier only, no spending, no self-hosting, in-app feed only (no email/push/SMS), Cadence is React Router v7 + Node + SQLite.

## Summary

| | Novu | Knock | Courier | MagicBell |
|---|---|---|---|---|
| Free plan | Free: 10,000 workflow runs/mo | Free: 10,000 messages/mo | Developer: 10,000 sends/mo | Builder: 1,000 deliveries/mo |
| Subscriber / MAU cap | Unlimited subscribers | No MAU cap listed | Not stated | Unlimited users |
| Hard cap or overage risk | Not stated (paid plans bill $1.20 per 1K extra runs) | No hard cap; Knock contacts you to add billing | Card needed to go above 10k (implies gate) | Overage "charged per use" (Startup rate $0.0025/delivery) |
| In-app feed listed as included on free | Yes | Yes | **Not stated** on pricing page | Yes (it is the product) |
| Prebuilt React UI | Yes (`<Inbox />`) | Yes (`@knocklabs/react`) | Yes (`CourierInbox`) | Yes (`@magicbell/react`) |
| Headless | Yes (`@novu/react` hooks, `@novu/js`) | Yes (React hooks) | Yes (Courier JS SDK) | Not documented on pages read |
| Real-time | WebSocket | Web socket | "Socket" (transport not named) | Not documented on pages read |
| User identity | subscriberId + HMAC hash | user id + signed JWT (RS256) | user_id + scoped JWT | external_id/email + HS256 JWT |
| Dev/test environments on free | Dev + Prod | Unlimited environments; sandbox mode | Test + Production | 1 project only on free |
| Free feed retention | Activity feed 24 h (see caveat) | Feed items kept; message logs 30 days | Inbox messages 1 year | Not stated |

**Recommendation for the next ticket:** Knock and Novu both fit. Knock has the strongest free-tier fit (10k messages, unlimited environments, unlimited feed retention, documented socket, no hard cap but no spend until you add billing). Novu is the closest alternative, but its free plan caps at 5 workflows and has a 24 h activity feed retention. Courier is blocked by an unconfirmed in-app entitlement on its free plan. MagicBell's 1,000 deliveries and single project make it the weakest fit for a demo with a dev and a prod setup.

---

## Novu

**Free tier.** [Pricing](https://novu.co/pricing) lists, for Free: 10,000 workflow runs/month, unlimited subscribers, up to 3 team members, up to 5 workflows, 2 environments (Dev + Prod), 60 RPS throughput, all channels including In-app, activity feed retention 24 hours. Additional runs are listed as $1.20 per 1K for Pro and Team; Free shows no overage price. The FAQ answers on what happens past the limit and what a "workflow run" is were not retrievable, so hard stop vs. overage on Free is **not confirmed**. Custom retention is Enterprise only.

- Fit risk: the 5-workflow cap versus Cadence's 9 starting Notifications. Mitigation (inference, not tested): fewer workflows using `payload` fields for text and link. The in-app step uses Liquid templating over `payload.*` ([in-app step](https://docs.novu.co/.mintlify/skills/dashboard-workflows/references/in-app-step.md)).

**Feed.** Prebuilt `<Inbox />` with bell, notification list and preferences; headless via `@novu/react` hooks or `@novu/js`. React 18+ and 19 supported ([Inbox overview](https://docs.novu.co/platform/inbox/overview)). Headless client: `novu.notifications.count({ read: false })`, `list`, `read(id)`, `readAll()`, `archive`, `archiveAll` ([headless examples](https://docs.novu.co/.mintlify/skills/inbox-integration/references/headless-inbox-examples.md)). Redirect/primary-action (deep link) configuration was **not stated** on the pages read; only `payload.*` templating is documented for the in-app step.

**Identity.** You supply `subscriberId`; subscribers are created on first session. Production requires an HMAC-SHA256 `subscriberHash` of the subscriber id keyed with the secret key, "HMAC is mandatory in production" ([Inbox security](https://docs.novu.co/.mintlify/skills/inbox-integration/references/security.md)). Fits a React Router loader that signs the hash server-side.

**Real-time.** The `@novu/js` client keeps a WebSocket open automatically ([headless examples](https://docs.novu.co/.mintlify/skills/inbox-integration/references/headless-inbox-examples.md)); regional socket URLs via `socketUrl` ([NovuProvider](https://docs.novu.co/platform/inbox/react/hooks)).

**Server trigger.** `@novu/api`: `new Novu({ secretKey })`, then `novu.trigger({ workflowId, to, payload, transactionId })`; `to` can be a subscriber id string or an object that upserts the subscriber; `transactionId` supports idempotency ([trigger examples](https://docs.novu.co/.mintlify/skills/trigger-notification/references/single-trigger-examples.md)). Plain Node, so it fits RR7 actions/loaders and server modules.

**Dev/test.** Dev and Prod environments on Free ([pricing](https://novu.co/pricing)). A test workflow can be run from the dashboard ([quickstart](https://docs.novu.co/platform/quickstart/nextjs)). No dedicated testing guide or sandbox/no-delivery flag was found; tests would need a mocked `@novu/api` client or the Dev environment (inference).

## Knock

**Free tier.** [Pricing](https://knock.app/pricing): up to 10,000 messages/month (bounced or failed sends not counted), unlimited stored profiles, no MAU cap listed, unlimited environments, 30-day log retention, unlimited feed retention, unlimited feeds per recipient, Feed API, pre-built and custom components. Limits: Knock branding cannot be removed, no translations, no per-tenant branding. "There's no hard cap on messages. If you exceed your limit without a billing method, Knock will contact you to set one up the following month." So no spend unless you add a billing method.

**Feed.** Prebuilt `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed` in `@knocklabs/react` ([feed docs](https://docs.knock.app/in-app-ui/react/feed)); a headless hook set also exists ([React overview](https://docs.knock.app/in-app-ui/react/overview), [headless feed](https://docs.knock.app/in-app-ui/react/headless/feed)). Badge counts "seen" by default; `badgeCountType="unread"` counts unread. Opening the popover marks items seen, not read; to mark read use `feedClient.markAsRead()` in an `onOpen` or click handler. Headless: `metadata.unread_count`/`unseen_count` from `useNotificationStore`, `markAsSeen`, `markAllAsSeen`. A mark-all-as-read call is **not shown** on the pages read; a batch "Mark messages as read" endpoint exists in the API reference ([index](https://docs.knock.app/llms.txt)). Deep links: an Action URL on the template gets an automatic redirect handler; `onNotificationClick` allows custom routing, which suits RR7 client navigation.

**Identity.** You supply the user id (`user={{ id }}` plus public key). Enhanced security mode (off by default, recommended before release) requires a signed user token: RS256 JWT signed with a private signing key, `sub` = user id, 3600 s default expiry via `signUserToken` in `@knocklabs/node`. It can stay off in the development environment ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).

**Real-time.** A web socket delivers a `new-message` event carrying badge-count metadata only (not full contents) and may be throttled ([API overview](https://docs.knock.app/in-app-ui/api-overview)). Tabs disconnect after a delay when inactive, with a BroadcastChannel option for cross-tab sync ([feed docs](https://docs.knock.app/in-app-ui/react/feed)).

**Server trigger.** Trigger endpoint takes recipients (string id, object ref or inline), `data` (JSON, up to 10 MB), `actor`, `tenant`, and an `Idempotency-Key` header (24 h replay) ([trigger API](https://docs.knock.app/send-notifications/triggering-workflows/api)). The `@knocklabs/node` SDK exists (used for `signUserToken`); the page read did not give workflow-trigger SDK syntax.

**Dev/test.** Production only by default; enabling environments adds a development environment, each with its own API keys ([environments](https://docs.knock.app/version-control/environments)). `settings.sandbox_mode: true` on a trigger generates messages without delivering them to providers; `skip_delay` skips delays; dashboard test runner exists ([testing workflows](https://docs.knock.app/send-notifications/testing-workflows)). The docs do not say whether sandbox messages appear in the feed.

**Retention.** Free plan message logs 30 days; feed items stay retrievable after logs expire ([data retention](https://docs.knock.app/manage-your-account/data-retention)).

## Courier

**Free tier.** [Pricing](https://www.courier.com/pricing): Developer plan, free, up to 10,000 sends/month; one send = one template to one recipient regardless of channel count; Test and custom environments count the same as Production. To exceed 10k you add a card and move to Business ($0.005 per send, including the first 10k). Whether Developer hard-stops is **not stated**. The pricing page does **not list Inbox among Developer features**, so in-app availability on the free plan is **unconfirmed**. Of the four candidates this is the largest open question and should be resolved with Courier before choosing it.

**Feed.** `CourierInbox` from `@trycourier/courier-react` (React 18+). Headless via the Courier JS SDK ([custom inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox.md)): `inbox.totalUnreadCount`, `readMessage`, `readAllMessages()`, `clickMessage`. Messages expose `actions` and `data`; the send docs say extra `data` fields pass through and can be used to deep link ([send to inbox](https://www.courier.com/docs/in-app/send-to-the-inbox.md)).

**Identity.** `to.user_id` is your own id. Browser auth uses a JWT minted by your backend via `POST /auth/issue-token` (or `client.auth.issueToken`) with scopes `user_id:<id> inbox:read:messages inbox:write:events`; `expires_in` is optional but should always be set ([authenticate](https://www.courier.com/docs/in-app/authenticate-users.md)). Tokens are not auto-refreshed by SDKs.

**Real-time.** The inbox opens a realtime "socket" after sign-in; read/opened/archived state syncs across devices; transport beyond "socket" **not stated** ([inbox behavior](https://www.courier.com/docs/in-app/how-the-inbox-behaves.md)). Inbox messages retained 1 year; per-message expiry via `message.expiry`.

**Server trigger.** `@trycourier/courier` v7+, `client.send.message({ message: { to: { user_id }, template, data, routing: { method: "single", channels: ["inbox"] } } })`, or `POST https://api.courier.com/send` ([send to inbox](https://www.courier.com/docs/in-app/send-to-the-inbox.md)).

**Dev/test.** Separate Test and Production environments with their own keys, templates and logs; sends in Test show only in the Test dashboard ([go live](https://www.courier.com/docs/guides/go-live.md)). Whether Test sends use quota: pricing page says they count the same.

## MagicBell

**Free tier.** [Pricing](https://www.magicbell.com/pricing): Builder, $0, 1,000 deliveries/month, 1 project, unlimited users and team members. "Once you hit your plan's included limit, each additional delivery will be charged per use for the rest of the month." Startup is $249/month with 50,000 deliveries and $0.0025 per extra delivery. The Builder overage rate is **not stated**, so exceeding 1,000 may cost money; that conflicts with the no-spend rule unless you stay under the cap. Retention and MAU: **not stated**.

**Feed.** React components (`ContextProvider`, `Inbox`, `FloatingInbox`, `InlineNotification`, `ToastContainer`, etc.) with `onNotificationClick` to intercept clicks ([React components](https://www.magicbell.com/docs/libraries/magicbell-react)). Headless hooks, unread count API and mark-all-read were **not documented** on the pages read, though a `@magicbell/react-headless` package exists (seen in search results only; not verified here).

**Identity.** User JWT minted on your backend: payload `api_key` plus `user_external_id` and/or `user_email`, signed HS256 with the project secret; `external_id` cannot be changed once set; examples use 1-year expiry ([user auth](https://www.magicbell.com/docs/api/authentication/user)).

**Real-time.** Not documented on the pages read.

**Server trigger.** Quick start references `POST /broadcasts` with a Project JWT; field details (including `action_url`) were not on the page read ([quick start](https://www.magicbell.com/docs/quick-start/adding-magicbell-to-your-product)).

**Dev/test.** Separate projects for staging and production are recommended, but Builder includes only 1 project, so no separate staging on free.

---

## Other candidates

Not researched in depth in this pass. The brief allowed "anything else that fits"; none were evaluated, so this is an open gap rather than a finding that none exist.

## Fit with Cadence (React Router v7 + Node + SQLite)

All four expose a Node server API and a browser SDK, so triggers belong in server code (route actions or event handlers) and the feed in a client component in the app shell. All four need a server-signed credential for production (Novu HMAC, Knock RS256 JWT, Courier JWT, MagicBell HS256 JWT), which a RR7 loader or an authenticated resource route can mint from the session user. Existing tests can use a stubbed server client in place of the real SDK (inference; no vendor documents an in-process fake). The DevUI user switcher maps naturally to supplying a different user id/subscriber id per switched user.

## Open questions

- Novu: behaviour past 10,000 runs on Free, definition of "workflow run", redirect/deep-link field for the in-app step, whether 24 h activity feed retention also limits what the Inbox shows.
- Knock: confirm a one-call "mark all as read" in the React SDK; confirm whether sandbox-mode messages appear in the feed; confirm whether workflows count is capped on Free.
- Courier: whether Inbox is included on Developer; hard stop at 10k.
- MagicBell: Builder overage terms; headless, real-time and mark-all-read docs.
