---
sidebar_position: 2
title: Architecture Overview
---

# Architecture Overview

Here's how all the pieces fit together. If you're used to building client-server games, the P2P model flips a few things on its head — but it's actually simpler than you'd think.

## The big picture

```
┌─────────────────┐          Hyperswarm           ┌─────────────────┐
│   Player 1      │◄──── encrypted stream ────►   │   Player 2      │
│   (Host)        │                                │   (Guest)       │
│                 │                                │                 │
│  • Ball physics │  ◄── { t:'input', y } ──────  │  • Paddle input  │
│  • Collision    │  ──── { t:'state', ... } ──►   │  • Render state  │
│  • Scoring      │                                │                 │
│  • Leaderboard  │  ──── { t:'match-result' } ►   │  • Leaderboard  │
│    (Hypercore)  │                                │    (Hypercore)  │
└─────────────────┘                                └─────────────────┘
```

## How peers find each other

Both players join the **same Hyperswarm topic** — a 32-byte key derived from a shared secret. Think of it like a room name, but cryptographic.

```js
const topic = crypto.decode('70656172706f6e67...')
swarm.join(topic, { client: true, server: true })
```

Hyperswarm uses the **HyperDHT** (distributed hash table) to find other peers who've joined the same topic. It handles NAT traversal (holepunching) automatically — no port forwarding needed.

**This replaces:** a matchmaking server, WebSocket connections, and STUN/TURN infrastructure.

## Role assignment

When two peers connect, they need to agree on who's Player 1 (host) and who's Player 2 (guest). We do this **deterministically** by comparing public keys:

```js
const myKey = crypto.encode(swarm.keyPair.publicKey)
const peerKey = crypto.encode(conn.remotePublicKey)
isPlayer1 = myKey < peerKey
role = isPlayer1 ? 'host' : 'guest'
```

Both peers run this exact same logic, so they always agree without any negotiation messages. Whoever has the "smaller" key becomes the host.

## The host-authority model

This is the core architectural decision. In a P2P game, you need to decide: **who is the source of truth?**

We use the **host-authority** model:

- **Host (Player 1)** runs the game simulation — ball physics, collision detection, scoring
- **Guest (Player 2)** only sends its paddle position to the host
- **Host broadcasts** the full game state to the guest ~60 times per second

### Why this model?

| Approach | Pros | Cons |
|----------|------|------|
| **Host-authority** (what we use) | Simple, no conflicts, one source of truth | Guest has ~1 RTT latency |
| Lockstep | Both peers in perfect sync | Complex, sensitive to latency |
| Rollback/prediction | Low perceived latency | Very complex to implement |

For Pong, host-authority is the sweet spot. The guest sees a small delay, but the game is simple enough that it feels fine.

## Message protocol

All messages are JSON, sent over the Hyperswarm encrypted stream via `peer.write()`:

**Host → Guest:**
```json
{ "t": "state", "left": { "y": 160, "score": 2 }, "right": { "y": 200, "score": 1 }, "ball": { "x": 400, "y": 200, "vx": 5, "vy": -2 }, "running": true, "over": false }
```

**Guest → Host:**
```json
{ "t": "input", "y": 180 }
```

**Either → Either:**
```json
{ "t": "serve" }
{ "t": "reset" }
{ "t": "hello", "id": "a1b2c3d4" }
{ "t": "match-result", "entry": { "winner": "a1b2c3d4", "loser": "e5f6g7h8", ... } }
```

## Leaderboard persistence

When a match ends, the host creates a match result and:
1. Writes it to its own local **Hypercore** (append-only log)
2. Sends it to the guest as a `match-result` message
3. The guest writes it to *their own* local Hypercore

This means both players have a persistent, tamper-proof record of every match — surviving app restarts without any server or database.

```js
const store = new Corestore(Pear.config.storage)
const localCore = store.get({ name: 'match-log' })
await localCore.append(Buffer.from(JSON.stringify(entry)))
```

**This replaces:** a hosted database, an API, and authentication.

## How it differs from centralized

| Centralized | Pear Pong (P2P) |
|-------------|-----------------|
| Server runs game logic | Host peer runs game logic |
| Server stores scores | Each peer stores scores locally in Hypercore |
| Players connect to server IP | Players discover each other via DHT |
| Server pays for hosting | Zero infrastructure cost |
| Single point of failure | Works as long as peers are online |
