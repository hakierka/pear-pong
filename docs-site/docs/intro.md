---
sidebar_position: 1
slug: /
title: App Overview
---

# Pear Pong 🏓

**Classic Pong, but make it peer-to-peer.**

Pear Pong is a real-time multiplayer Pong game that runs entirely P2P — no servers, no APIs, no room codes. Two players connect directly over the internet using [Pear Runtime](https://docs.pears.com/) and [Hyperswarm](https://docs.pears.com/building-blocks/hyperswarm).

## Why does this exist?

This project was built to demonstrate how to use Holepunch's P2P stack to create a real-time game. It's designed to be **educational** — the kind of thing you can read through, understand, and then build your own P2P app from.

If you've ever wondered "how would I build multiplayer without a server?" — this is your starting point.

## What it demonstrates

- **Peer discovery** — Hyperswarm finds your opponent automatically using the DHT. No IP addresses, no matchmaking server.
- **Real-time state sync** — the host-authority model keeps the game in sync across two peers with minimal latency.
- **Persistent leaderboard** — match results are stored in a local [Hypercore](https://docs.pears.com/building-blocks/hypercore) append-only log. No database needed.
- **Desktop P2P app** — runs as a native desktop app via `pear://` links. Install once, play anywhere.

## What you'll learn from the docs

- [**Architecture**](./architecture) — how the host/guest model works, what messages flow between peers
- [**Setup**](./setup) — how to get it running in under 2 minutes
- [**Implementation Walkthrough**](./walkthrough) — step-by-step through the code, from connection to gameplay
- [**Code Structure**](./code-structure) — what each file does
- [**How to Extend**](./extending) — ideas for adding features like spectator mode, sound, or rooms

## The tech

| Module | Role |
|--------|------|
| [Pear Runtime](https://docs.pears.com/) | P2P desktop app platform |
| [Hyperswarm](https://docs.pears.com/building-blocks/hyperswarm) | Peer discovery + encrypted connections |
| [Hypercore](https://docs.pears.com/building-blocks/hypercore) | Append-only log for leaderboard persistence |
| [Corestore](https://docs.pears.com/helpers/corestore) | Manages Hypercore storage on disk |
| Plain JS + Canvas | Game engine — no frameworks needed |

## Quick taste

Both players just run one command:

```bash
pear run pear://krx4hk66o69wt13cbythmw44oasyiny1tj4kkputhfaq1j95nh6o
```

That's it. Hyperswarm does the rest. ✨
