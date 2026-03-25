# Pear Pong 🏓

Classic Pong, but make it peer-to-peer. No servers. No APIs. No room codes. Just two players, connected directly over the P2P network using [Pear Runtime](https://docs.pears.com/).

![Pear Pong](images/pearpongUI.png)

## So what's this about?

I built Pear Pong to show how easy it is to make real-time multiplayer games with zero infrastructure. The whole thing runs on [Holepunch's](https://holepunch.to/) P2P stack:

- **[Hyperswarm](https://docs.pears.com/building-blocks/hyperswarm)** finds your opponent automatically — no IP addresses, no matchmaking server
- **[Hypercore](https://docs.pears.com/building-blocks/hypercore)** keeps a tamper-proof leaderboard that persists across sessions
- **[Pear Runtime](https://docs.pears.com/)** packages it all into a desktop app you can share with a single link

The whole game is ~400 lines of plain JavaScript. No frameworks, no build tools. Just vibes and UDP holepunching. ✨

## Play it right now

You just need [Pear](https://docs.pears.com/) installed:
```bash
npx pear
```

Then both players run:
```bash
pear run pear://krx4hk66o69wt13cbythmw44oasyiny1tj4kkputhfaq1j95nh6o
```

That's literally it. Hyperswarm does the matchmaking. You'll see who you are (Player 1 or Player 2), and you're off. 🏓

> **On the same machine?** Use `--tmp-store` for the second window so they get separate identities:
> ```bash
> pear run -d --tmp-store .
> ```

### What if a third person joins?
It's 1v1 only. Extra players wait in the lobby until someone disconnects. No drama.

## How to play

| Action | Key |
|--------|-----|
| Move paddle | `W` / `S` |
| Serve ball | `Space` |
| Rematch | `Space` (after game ends) |

Your paddle glows green so you know which side you're on. Both players use the same keys — simple.

## How it actually works

When two peers find each other on the swarm, they compare public keys to decide who's who:

- **Player 1** (left paddle) — runs the physics, owns the game state, broadcasts everything ~60 times per second
- **Player 2** (right paddle) — sends paddle position to Player 1, renders whatever comes back

This is called the **host-authority model** — one peer is the source of truth. It's the simplest way to keep a P2P game in sync without conflicts. The tradeoff? Player 2 sees about one round-trip of latency. Totally fine for Pong.

When a match ends, the result gets written to both players' local [Hypercore](https://docs.pears.com/building-blocks/hypercore) — an append-only log that persists to disk. That's your leaderboard. No database. No server. Just math and cryptography. 🔐

## Run from source

Want to hack on it? Go for it:
```bash
git clone https://github.com/hakierka/pear-pong.git
cd pear-pong
npm install
pear run -d .
```

## Tech Stack

| What | Why |
|------|-----|
| [Pear Runtime](https://docs.pears.com/) | P2P desktop app platform |
| [pear-electron](https://docs.pears.com/) | Desktop UI shell |
| [Hyperswarm](https://docs.pears.com/building-blocks/hyperswarm) | Peer discovery + encrypted connections |
| [Hypercore](https://docs.pears.com/building-blocks/hypercore) | Persistent append-only leaderboard |
| [Corestore](https://docs.pears.com/helpers/corestore) | Manages Hypercore storage |
| Plain JS + Canvas | Because you don't need React for Pong |

## Project Structure
```
pear-pong/
├── index.js       # Pear electron bootstrap
├── index.html     # Game UI + styles
├── app.js         # Game engine + P2P networking + leaderboard
├── package.json   # Pear config + dependencies
└── images/        # Screenshots
```

## License
MIT — do whatever you want with it. 🍐
