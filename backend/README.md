# Recorn backend

Backend-only competitive platform for Blox Strike. No UI is included.

## State machine

IDLE -> QUEUED -> MATCH_FOUND -> ACCEPTING -> READY -> LOBBY -> IN_PROGRESS -> AWAITING_CONFIRMATION -> COMPLETED

Terminal/exception states: CANCELLED, DISPUTED, ABORTED, EXPIRED.

- IDLE→QUEUED: player joins Redis queue.
- QUEUED→MATCH_FOUND/ACCEPTING: matcher reserves players and creates Match.
- ACCEPTING→READY: every MatchPlayer accepts before 30s.
- ACCEPTING→CANCELLED: decline/timeout; refusing player receives cooldown + -25 ELO.
- READY→LOBBY: server creates unique VIP lobby and assigns host.
- LOBBY→IN_PROGRESS: host starts after accepted players are present.
- IN_PROGRESS→AWAITING_CONFIRMATION: host submits validated result.
- AWAITING_CONFIRMATION→COMPLETED: majority confirms or 15-minute BullMQ timeout expires.
- AWAITING_CONFIRMATION→DISPUTED: any participant disputes; admin resolves later.

## Matchmaking

Formats are configured in src/matchmaking.service.ts: 1v1, 2v2, 3v3, 5v5. Redis sorted sets use ELO as score and PostgreSQL joinedAt for FIFO tie-breaking. Tolerance is ±100 ELO for the first 30s, ±300 through 120s, then ±600. A unique (userId,format) row plus Redis ZSET membership prevents double queueing.

## ELO

Expected score: E = 1 / (1 + 10^((opponentAverage - playerElo)/400)).
Delta: round(K * (actual - E)), K=32. ELO is clamped to 100..4000. K/D is stored for history but does not directly change rating to prevent stat-padding.

## Results

Only the assigned host can submit POST /matches/:id/result. Each screenshot is ≤10MB and only PNG/JPEG/WebP. SHA-256 makes uploads idempotent. Result data contains final score, winner and K/D for every participant. Any participant may dispute. BullMQ auto-confirms pending confirmations after 15 minutes.

## REST API

Authentication: Authorization: Bearer <JWT>.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /auth/register | public | Create player account |
| POST | /auth/login | public | Issue JWT |
| GET | /auth/roblox/start | player | Start Roblox account linking |
| GET | /auth/roblox/callback | player | Finish Roblox linking |
| POST | /queue/join | player | Join format queue; Roblox + cooldown required |
| POST | /queue/leave | player | Leave queue |
| GET | /matches/:id | participant | Read private match |
| POST | /matches/:id/accept | participant | Accept within 30s |
| POST | /matches/:id/decline | participant | Decline and trigger penalty |
| POST | /matches/:id/lobby | participant | Create VIP lobby after READY |
| POST | /matches/:id/lobby/start | host | Start game |
| POST | /matches/:id/lobby/kick | host | Kick participant |
| POST | /matches/:id/result | host | Multipart result + screenshots |
| GET | /matches/:id/result | participant | Read result/screenshot/confirmations |
| POST | /matches/:id/result/confirm | participant | CONFIRMED or DISPUTED |
| GET | /admin/disputes | admin | Review disputes |
| POST | /admin/disputes/:id/resolve | admin | Resolve dispute |

Common errors: 400 invalid payload, 401 invalid JWT, 403 role/ownership failure, 404 private resource not found, 409 invalid state/duplicate operation, 413 file too large, 429 cooldown/rate limit.

## Socket.IO

Client→server: join_queue {format}, leave_queue {format}, accept_match {matchId}, decline_match {matchId}, join_lobby {matchId}, lobby_ready {matchId}, lobby_kick {matchId,targetUserId}, lobby_start {matchId}, lobby_chat_send {matchId,message}, result_confirm {matchId,decision}. Binary result upload remains REST multipart.

Server→client: match_found, match_cancelled, lobby_updated, chat_message, result_uploaded, result_confirmed, result_disputed, match_completed plus match_accept_updated, match_ready, lobby_player_ready, lobby_kicked and match_started.

All match events use room match:{id}; membership is verified before joining.

## Security

Roblox account is mandatory before queueing. JWT is required for private REST and Socket.IO. Match data is private to participants. Host-only result submission is checked server-side. Screenshots are size/type limited and SHA-256 deduplicated. Queue/accept/upload endpoints are rate-limited. Cooldowns are checked before queue insertion. Illegal state transitions are rejected. Result confirmation is idempotent. ELO and history are written in one transaction.

## Run

1. cd backend && cp .env.example .env
2. docker compose -f docker-compose.yml up -d
3. npm install
4. npx prisma generate
5. npx prisma migrate dev --name init
6. npm run dev
7. Run npm run worker in a second process.

Production should use prisma migrate deploy, TLS, private S3/MinIO with signed URLs, Redis authentication/TLS, a real Roblox OAuth callback, and a dedicated matchmaking worker loop.
