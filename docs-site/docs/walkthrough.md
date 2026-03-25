---
sidebar_position: 4
title: Implementation Walkthrough
---

# Implementation Walkthrough

Let's walk through how Pear Pong works, step by step. We'll follow the flow from app launch to gameplay to leaderboard. All the interesting stuff happens in `app.js`.

## Step 1: Bootstrap the Pear app

The entry point is `index.js`, which sets up the Pear electron shell:

```js
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const bridge = new Bridge()
await bridge.ready()

const runtime = new Runtime()
const pipe = await runtime.start({ bridge })
pipe.on('close', () => Pear.exit())
```

This loads `index.html`, which in turn loads `app.js` as a module. The game logic lives entirely in the browser context.

## Step 2: Set up the Hyperswarm connection

```js
const swarm = new Hyperswarm()
Pear.teardown(() => {
  swarm.destroy()
  store.close()
})

const topic = crypto.decode('70656172706f6e67...')
swarm.join(topic, { client: true, server: true })
```

`swarm.join()` announces our presence on the DHT under this topic. We set both `client: true` and `server: true` so either peer can initiate the connection.

The `Pear.teardown()` callback ensures we clean up when the app closes — important for releasing DHT resources.

## Step 3: Handle peer connections

```js
swarm.on('connection', (conn) => {
  if (peer) { conn.destroy(); return }  // 1v1 only

  peer = conn

  // Deterministic role assignment
  const myKey = crypto.encode(swarm.keyPair.publicKey)
  const peerKey = crypto.encode(conn.remotePublicKey)
  isPlayer1 = myKey < peerKey
  role = isPlayer1 ? 'host' : 'guest'

  // Exchange leaderboard IDs
  send({ t: 'hello', id: myId })

  conn.on('data', onData)
  conn.on('close', () => { /* reset state */ })
})
```

Key things happening here:
- **One connection only** — if we already have a peer, reject extras
- **Role assignment** — deterministic, no negotiation needed
- **Identity exchange** — `hello` messages share leaderboard IDs

## Step 4: Handle incoming messages

The `onData` function is a simple message router:

```js
function onData (buf) {
  let msg
  try { msg = JSON.parse(buf.toString()) } catch { return }

  if (msg.t === 'hello')        → store peer's leaderboard ID
  if (msg.t === 'match-result') → record match to local Hypercore

  if (role === 'host') {
    if (msg.t === 'input') → update guest's paddle position
    if (msg.t === 'serve') → start the ball
    if (msg.t === 'reset') → reset the game
  } else {
    if (msg.t === 'state') → apply host's authoritative state
  }
}
```

Notice the guest **does not overwrite its own paddle position** from the host's state — this prevents the paddle from "snapping back" due to network latency.

## Step 5: The game loop

The game runs at ~60fps using `requestAnimationFrame`:

```js
function loop () {
  update()  // physics + input
  draw()    // render to canvas
  requestAnimationFrame(loop)
}
```

### Host update

The host handles everything:
1. Read local keyboard → move left paddle
2. Move ball
3. Check wall bounces
4. Check paddle collisions (with spin based on hit position)
5. Check scoring
6. Check win condition

### Guest update

The guest only does:
1. Read local keyboard → move right paddle
2. Send paddle position to host: `send({ t: 'input', y: state.right.y })`

## Step 6: Network sync

The host broadcasts the full game state at ~60Hz:

```js
setInterval(() => {
  if (role === 'host' && peer) {
    send({
      t: 'state',
      left: state.left,
      right: state.right,
      ball: state.ball,
      running: state.running,
      over: state.over
    })
  }
}, 16)  // ~60 Hz
```

This is intentionally simple — the entire state is small enough to send every frame without compression.

## Step 7: Scoring and leaderboard

When someone wins (first to 5 points), the host:

```js
const entry = {
  winner: winnerId,
  loser: loserId,
  winnerScore: ...,
  loserScore: ...,
  ts: Date.now()
}
recordMatch(entry)              // Write to local Hypercore
send({ t: 'match-result', entry })  // Tell the guest
```

The guest receives the `match-result` message and writes it to *their own* Hypercore. Both peers now have a persistent record.

The leaderboard reads all entries from the local core, tallies wins/losses per player ID, and renders a sorted table.

## The full flow

```
App starts
  → Join Hyperswarm topic
  → Wait for peer...

Peer connects
  → Compare public keys → assign roles
  → Exchange hello messages
  → Show "Press Space to serve"

Game loop (60fps)
  Host: keyboard → paddle → physics → broadcast state
  Guest: keyboard → paddle → send input

Match ends
  Host: write result to Hypercore + broadcast
  Guest: receive result + write to own Hypercore
  Both: render updated leaderboard
```
