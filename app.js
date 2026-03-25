/* global Pear */
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import b4a from 'b4a'
import crypto from 'hypercore-id-encoding'

// ── DOM refs ──────────────────────────────────────────────────────────────
const statusEl = document.getElementById('status')
const scoreEl = document.getElementById('score')
const controlsEl = document.getElementById('controls')
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')

// ── Constants ─────────────────────────────────────────────────────────────
const W = canvas.width   // 800
const H = canvas.height  // 400
const PADDLE_W = 10
const PADDLE_H = 80
const BALL_SIZE = 8
const PADDLE_SPEED = 6
const BALL_SPEED_INIT = 5
const WINNING_SCORE = 5
const NET_TICK_MS = 16 // ~60 Hz network sync rate

// ── Roles ─────────────────────────────────────────────────────────────────
// The first peer (no connection yet) becomes HOST and controls the left
// paddle + ball physics.  The second peer becomes GUEST and controls the
// right paddle.  The host is the single source of truth: it runs the
// simulation and broadcasts the full game state every tick.  The guest
// only sends its paddle-y position.
//
// Message types (JSON over the Hyperswarm encrypted stream):
//   host  -> guest : { t:'state', left, right, ball, running, over }
//   guest -> host  : { t:'input', y: <number> }
//   either         : { t:'serve' }  |  { t:'reset' }
// ──────────────────────────────────────────────────────────────────────────
let role = 'host' // default until a peer connects
let peer = null

// ── Leaderboard (Hypercore-backed) ───────────────────────────────────────
// Each peer has a local Hypercore append-only log to persist match results.
// When a match ends, the host broadcasts the result to the guest, and BOTH
// peers write it to their own local core.  This means:
//   - Results persist across app restarts (Hypercore stores to disk)
//   - No server or database needed
//   - Each peer keeps a tamper-proof log of all matches they've seen
// ──────────────────────────────────────────────────────────────────────────
const store = new Corestore(Pear.config.storage)
const localCore = store.get({ name: 'match-log' })
await localCore.ready()

const myId = b4a.toString(localCore.key, 'hex').slice(0, 8)
const leaderboardEl = document.getElementById('leaderboard')

async function recordMatch (entry) {
  await localCore.append(Buffer.from(JSON.stringify(entry)))
  renderLeaderboard()
}

async function readAllMatches () {
  const matches = []
  const len = localCore.length
  for (let i = 0; i < len; i++) {
    const block = await localCore.get(i)
    if (!block) continue
    try {
      matches.push(JSON.parse(b4a.toString(block)))
    } catch { /* skip non-JSON blocks */ }
  }
  return matches
}

async function renderLeaderboard () {
  const matches = await readAllMatches()
  if (matches.length === 0) {
    leaderboardEl.innerHTML = '<em>No matches yet</em>'
    return
  }

  // Tally wins per player
  const stats = {}
  for (const m of matches) {
    if (!stats[m.winner]) stats[m.winner] = { wins: 0, losses: 0 }
    if (!stats[m.loser]) stats[m.loser] = { wins: 0, losses: 0 }
    stats[m.winner].wins++
    stats[m.loser].losses++
  }

  const rows = Object.entries(stats)
    .sort((a, b) => b[1].wins - a[1].wins)
    .map(([id, s], i) => {
      const you = id === myId ? ' (you)' : ''
      return `<tr><td>${i + 1}</td><td>${id}${you}</td><td>${s.wins}</td><td>${s.losses}</td></tr>`
    })
    .join('')

  leaderboardEl.innerHTML = `
    <table>
      <tr><th>#</th><th>Player</th><th>W</th><th>L</th></tr>
      ${rows}
    </table>
  `
}

// ── Game state ────────────────────────────────────────────────────────────
const state = {
  left:  { y: H / 2 - PADDLE_H / 2, score: 0 },
  right: { y: H / 2 - PADDLE_H / 2, score: 0 },
  ball:  { x: W / 2, y: H / 2, vx: 0, vy: 0 },
  running: false,
  over: false
}

// ── Input tracking ────────────────────────────────────────────────────────
const keys = {}
document.addEventListener('keydown', (e) => {
  keys[e.key] = true

  if (e.key === ' ') {
    if (state.over) {
      if (role === 'host') {
        resetGame()
      } else {
        send({ t: 'reset' })
      }
    } else if (!state.running) {
      if (role === 'host') {
        serve()
      } else {
        send({ t: 'serve' })
      }
    }
  }
})
document.addEventListener('keyup', (e) => { keys[e.key] = false })

// ── Networking helpers ────────────────────────────────────────────────────
function send (obj) {
  if (peer && !peer.destroyed) {
    peer.write(JSON.stringify(obj))
  }
}

let peerId = null // short ID of the connected peer

function onData (buf) {
  let msg
  try { msg = JSON.parse(buf.toString()) } catch { return }

  // Peer announces their leaderboard ID
  if (msg.t === 'hello') {
    peerId = msg.id
    return
  }

  // Match result broadcast — both sides record it
  if (msg.t === 'match-result') {
    recordMatch(msg.entry)
    return
  }

  if (role === 'host') {
    // Host receives guest input
    if (msg.t === 'input') {
      state.right.y = msg.y
    } else if (msg.t === 'serve' && !state.running && !state.over) {
      serve()
    } else if (msg.t === 'reset' && state.over) {
      resetGame()
    }
  } else {
    // Guest receives authoritative state from host
    // NOTE: we do NOT overwrite state.right.y here because the guest
    // controls its own paddle locally. Overwriting it would cause the
    // paddle to "snap back" due to network latency.
    if (msg.t === 'state') {
      state.left.y = msg.left.y
      state.left.score = msg.left.score
      state.right.score = msg.right.score
      state.ball = msg.ball
      state.running = msg.running
      state.over = msg.over
    }
  }
}

// ── P2P connection via Hyperswarm ─────────────────────────────────────────
const swarm = new Hyperswarm()
Pear.teardown(() => {
  swarm.destroy()
  store.close()
})

const topic = crypto.decode('70656172706f6e67746573743130313030303030303030303030303030303030')
swarm.join(topic, { client: true, server: true })

swarm.on('connection', (conn) => {
  // If we already have a peer, ignore additional connections
  if (peer) { conn.destroy(); return }

  peer = conn
  const id = crypto.encode(conn.remotePublicKey).slice(0, 6)

  // Role assignment: the peer whose public key is "smaller" hosts.
  // This is deterministic — both sides compute the same result.
  const myKey = crypto.encode(swarm.keyPair.publicKey)
  const theirKey = crypto.encode(conn.remotePublicKey)
  role = myKey < theirKey ? 'host' : 'guest'

  const side = role === 'host' ? 'LEFT' : 'RIGHT'
  statusEl.innerText = `Connected to ${id} — you are ${side} paddle`
  statusEl.style.background = '#2e7d32'
  controlsEl.textContent = 'You: W / S  ·  Space: serve'

  // Tell the peer our leaderboard ID
  send({ t: 'hello', id: myId })

  conn.on('data', onData)

  conn.on('close', () => {
    peer = null
    role = 'host'
    statusEl.innerText = 'Peer disconnected — waiting for player...'
    statusEl.style.background = '#222'
    controlsEl.textContent = 'Waiting for opponent...'
    resetGame()
  })

  conn.on('error', () => { /* handled by close */ })
})

// ── Serve the ball (host only) ────────────────────────────────────────────
function serve () {
  state.running = true
  const angle = (Math.random() * Math.PI / 4) - Math.PI / 8
  const dir = Math.random() < 0.5 ? 1 : -1
  state.ball.vx = dir * BALL_SPEED_INIT * Math.cos(angle)
  state.ball.vy = BALL_SPEED_INIT * Math.sin(angle)
  statusEl.innerText = 'Game on!'
}

// ── Reset ─────────────────────────────────────────────────────────────────
function resetBall () {
  state.ball.x = W / 2
  state.ball.y = H / 2
  state.ball.vx = 0
  state.ball.vy = 0
  state.running = false
  statusEl.innerText = peer ? 'Press Space to serve' : 'Waiting for player...'
}

function resetGame () {
  state.left.score = 0
  state.right.score = 0
  state.over = false
  resetBall()
}

// ── Update logic (host runs simulation, guest sends input) ────────────────
function update () {
  if (role === 'host') {
    // Host moves its own (left) paddle from local keys
    if (keys['w'] || keys['W']) state.left.y = Math.max(0, state.left.y - PADDLE_SPEED)
    if (keys['s'] || keys['S']) state.left.y = Math.min(H - PADDLE_H, state.left.y + PADDLE_SPEED)

    if (!state.running) return

    const ball = state.ball

    // Move ball
    ball.x += ball.vx
    ball.y += ball.vy

    // Top / bottom bounce
    if (ball.y - BALL_SIZE / 2 <= 0 || ball.y + BALL_SIZE / 2 >= H) {
      ball.vy *= -1
      ball.y = Math.max(BALL_SIZE / 2, Math.min(H - BALL_SIZE / 2, ball.y))
    }

    // Left paddle collision
    if (
      ball.vx < 0 &&
      ball.x - BALL_SIZE / 2 <= PADDLE_W + 10 &&
      ball.y >= state.left.y &&
      ball.y <= state.left.y + PADDLE_H
    ) {
      ball.vx = Math.abs(ball.vx) * 1.05
      ball.x = PADDLE_W + 10 + BALL_SIZE / 2
      const hitPos = (ball.y - state.left.y) / PADDLE_H - 0.5
      ball.vy += hitPos * 3
    }

    // Right paddle collision
    if (
      ball.vx > 0 &&
      ball.x + BALL_SIZE / 2 >= W - PADDLE_W - 10 &&
      ball.y >= state.right.y &&
      ball.y <= state.right.y + PADDLE_H
    ) {
      ball.vx = -Math.abs(ball.vx) * 1.05
      ball.x = W - PADDLE_W - 10 - BALL_SIZE / 2
      const hitPos = (ball.y - state.right.y) / PADDLE_H - 0.5
      ball.vy += hitPos * 3
    }

    // Scoring
    if (ball.x < 0) {
      state.right.score++
      if (!checkWin()) resetBall()
    } else if (ball.x > W) {
      state.left.score++
      if (!checkWin()) resetBall()
    }
  } else {
    // Guest: move local paddle with same keys and send position to host
    if (keys['w'] || keys['W']) state.right.y = Math.max(0, state.right.y - PADDLE_SPEED)
    if (keys['s'] || keys['S']) state.right.y = Math.min(H - PADDLE_H, state.right.y + PADDLE_SPEED)
    send({ t: 'input', y: state.right.y })
  }
}

function checkWin () {
  if (state.left.score >= WINNING_SCORE || state.right.score >= WINNING_SCORE) {
    const leftWon = state.left.score >= WINNING_SCORE
    const winner = leftWon ? 'Left' : 'Right'
    statusEl.innerText = `${winner} wins! Press Space to play again`
    state.running = false
    state.over = true

    // Host records match and broadcasts to guest so both persist it
    if (role === 'host') {
      const winnerId = leftWon ? myId : (peerId || 'guest')
      const loserId = leftWon ? (peerId || 'guest') : myId
      const entry = {
        winner: winnerId,
        loser: loserId,
        winnerScore: leftWon ? state.left.score : state.right.score,
        loserScore: leftWon ? state.right.score : state.left.score,
        ts: Date.now()
      }
      recordMatch(entry)
      send({ t: 'match-result', entry })
    }
    return true
  }
  return false
}

// ── Network sync (host broadcasts state at fixed rate) ────────────────────
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
}, NET_TICK_MS)

// ── Draw ──────────────────────────────────────────────────────────────────
function draw () {
  ctx.clearRect(0, 0, W, H)

  // Center dashed line
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = '#333'
  ctx.beginPath()
  ctx.moveTo(W / 2, 0)
  ctx.lineTo(W / 2, H)
  ctx.stroke()
  ctx.setLineDash([])

  // Paddles — highlight your own paddle in green
  const leftColor = role === 'host' ? '#4caf50' : '#fff'
  const rightColor = role === 'guest' ? '#4caf50' : '#fff'

  ctx.fillStyle = leftColor
  ctx.fillRect(10, state.left.y, PADDLE_W, PADDLE_H)
  ctx.fillStyle = rightColor
  ctx.fillRect(W - PADDLE_W - 10, state.right.y, PADDLE_W, PADDLE_H)

  // Ball
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(state.ball.x, state.ball.y, BALL_SIZE, 0, Math.PI * 2)
  ctx.fill()

  // Score display
  scoreEl.textContent = `${state.left.score} : ${state.right.score}`
}

// ── Game loop ─────────────────────────────────────────────────────────────
function loop () {
  update()
  draw()
  requestAnimationFrame(loop)
}

loop()
renderLeaderboard()
console.log('Pear-Pong loaded — waiting for peer...')
