---
sidebar_position: 6
title: How to Extend
---

# How to Extend

Pear Pong is designed to be a starting point. Here are some features you could add, with guidance on how to approach each one.

## 🏠 Room codes / private matches

Right now, everyone joins the same hardcoded topic. To support private matches:

```js
// Instead of a hardcoded topic, generate one from user input
import crypto from 'hypercore-crypto'

const roomCode = prompt('Enter a room code:')
const topic = crypto.data(Buffer.from(roomCode))  // deterministic hash
swarm.join(topic, { client: true, server: true })
```

Both players enter the same room code → they get the same topic → Hyperswarm connects them. No one else can accidentally join.

## 👀 Spectator mode

Currently we reject extra connections (`if (peer) { conn.destroy() }`). Instead, you could keep a list of spectators:

```js
const spectators = []

swarm.on('connection', (conn) => {
  if (!peer) {
    peer = conn  // first connection = opponent
  } else {
    spectators.push(conn)  // extra connections = spectators
  }
})
```

Then in the network sync, broadcast state to spectators too:

```js
for (const spec of spectators) {
  spec.write(JSON.stringify({ t: 'state', ...state }))
}
```

Spectators would be read-only — no paddle input accepted.

## 🔊 Sound effects

Add audio cues for paddle hits, scoring, and winning. The simplest approach with the Web Audio API:

```js
const audioCtx = new AudioContext()

function playBeep (freq = 440, duration = 0.1) {
  const osc = audioCtx.createOscillator()
  osc.frequency.value = freq
  osc.connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + duration)
}

// In paddle collision: playBeep(440)
// On score: playBeep(220, 0.3)
// On win: playBeep(880, 0.5)
```

## 📊 Richer leaderboard with Hypercore replication

Right now both peers write match results to their own local Hypercore. For a truly shared leaderboard, you could replicate cores between peers using a separate Hyperswarm connection:

```js
// Dedicated swarm for leaderboard replication
const leaderboardSwarm = new Hyperswarm()
const leaderboardTopic = crypto.data(Buffer.from('pear-pong-leaderboard'))
leaderboardSwarm.join(leaderboardTopic)

leaderboardSwarm.on('connection', (conn) => {
  store.replicate(conn)  // Corestore handles the rest
})
```

This way, even peers who haven't played each other can see the global leaderboard.

## 🌐 Blind peering for always-on leaderboard

Use [blind-peering](https://github.com/holepunchto/blind-peering) to keep leaderboard cores available even when players are offline:

```js
import BlindPeering from 'blind-peering'

const blindPeering = new BlindPeering(dht, store, {
  keys: [BLIND_PEER_KEY]  // a mirror service's public key
})

await blindPeering.addCore(localCore)
```

This sends your Hypercore to a blind mirror that keeps it online 24/7. Other peers can read it even when you're not around.

## 🎨 Better visuals

The canvas rendering is intentionally simple. Some ideas:
- **Particle effects** on paddle hits
- **Trail effect** on the ball
- **Animated score** transitions
- **CSS animations** on the status bar

Since we're using raw Canvas, you have full control — no framework limitations.

## ⚡ Latency improvements

The current model sends full state every frame. For lower latency:

- **Delta compression** — only send what changed since last frame
- **Client-side prediction** — the guest predicts ball movement locally and corrects when the host's state arrives
- **Input delay** — buffer inputs for 1-2 frames to smooth out jitter

These are standard game networking techniques. For Pong they're overkill, but they're great to learn.

## 🏆 Tournament mode

Chain multiple matches together:
1. Keep a `matchCount` and `totalWins` per player
2. After each match, increment and check for best-of-3 or best-of-5
3. Show a tournament bracket in the leaderboard area

This is pure game logic — no P2P changes needed.
