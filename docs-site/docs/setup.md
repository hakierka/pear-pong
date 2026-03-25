---
sidebar_position: 3
title: Setup Instructions
---

# Setup Instructions

Getting Pear Pong running takes about 2 minutes. Here are all the ways to do it.

## Option 1: Run from the pear:// link (easiest)

You just need Pear Runtime installed. If you don't have it yet:

```bash
npx pear
```

Follow the prompts to finish setup. Then run:

```bash
pear run pear://krx4hk66o69wt13cbythmw44oasyiny1tj4kkputhfaq1j95nh6o
```

A window opens and starts looking for an opponent. Have the second player run the same command on their machine. Done!

## Option 2: Run from source (for devs)

```bash
git clone https://github.com/hakierka/pear-pong.git
cd pear-pong
npm install
pear run -d .
```

The `-d` flag enables dev mode (opens devtools automatically).

### Testing with two players on one machine

You need each instance to have a separate identity. Use `--tmp-store` for the second window:

**Terminal 1:**
```bash
pear run -d .
```

**Terminal 2:**
```bash
pear run -d --tmp-store .
```

Both windows will auto-discover each other and you can play (switching between windows to move each paddle).

## Prerequisites

- **Node.js** v18+ — [download here](https://nodejs.org/)
- **Pear Runtime** — `npx pear` to bootstrap
- A standard desktop or laptop (macOS, Linux, or Windows)
- An internet connection (for peer discovery via HyperDHT)

:::tip No unusual hardware needed
Pear Pong runs on any regular computer. No GPU, no special networking setup, no port forwarding.
:::

## Verifying it works

When the app launches, you should see:

1. **"👀 Looking for an opponent..."** — the app is searching the swarm
2. **"🕹️ You are PLAYER 1 (Left Side)"** — connected! Roles assigned
3. Press **Space** to serve the ball

If you're stuck on step 1, make sure both machines are online and not behind a very restrictive corporate firewall.

## Staging & seeding (for distributors)

If you want to publish your own version via a `pear://` link:

```bash
pear stage .          # Package the app
pear release .        # Mark it as a release
pear seed .           # Start seeding (keep this running)
```

The `pear stage` command will output your unique `pear://` link. Share it with anyone who has Pear installed.
