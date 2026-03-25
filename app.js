/* global Pear */
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-id-encoding'

// ── P2P connection (kept from Phase 1, will be wired in Phase 2) ──────────
const swarm = new Hyperswarm()
Pear.teardown(() => swarm.destroy())

const topic = crypto.decode('70656172706f6e67746573743130313030303030303030303030303030303030')
swarm.join(topic, { client: true, server: true })

let peer = null

swarm.on('connection', (conn) => {
  peer = conn
  const id = crypto.encode(conn.remotePublicKey).slice(0, 6)
  statusEl.innerText = `Connected to Peer: ${id}`
  statusEl.style.background = '#2e7d32'

  conn.on('data', (data) => {
    // Phase 2 will handle incoming game state here
    console.log(`Received from ${id}:`, data.toString())
  })

  conn.on('close', () => {
    peer = null
    statusEl.innerText = 'Peer disconnected — local mode'
    statusEl.style.background = '#222'
  })
})

// ── DOM refs ──────────────────────────────────────────────────────────────
const statusEl = document.getElementById('status')
const scoreEl = document.getElementById('score')
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
  if (e.key === ' ' && !state.running && !state.over) serve()
  if (e.key === ' ' && state.over) resetGame()
})
document.addEventListener('keyup', (e) => { keys[e.key] = false })

// ── Serve the ball ────────────────────────────────────────────────────────
function serve () {
  state.running = true
  const angle = (Math.random() * Math.PI / 4) - Math.PI / 8 // slight random angle
  const dir = Math.random() < 0.5 ? 1 : -1
  state.ball.vx = dir * BALL_SPEED_INIT * Math.cos(angle)
  state.ball.vy = BALL_SPEED_INIT * Math.sin(angle)
  statusEl.innerText = 'Game on!'
}

// ── Reset after a point ───────────────────────────────────────────────────
function resetBall () {
  state.ball.x = W / 2
  state.ball.y = H / 2
  state.ball.vx = 0
  state.ball.vy = 0
  state.running = false
  statusEl.innerText = 'Press Space to serve'
}

function resetGame () {
  state.left.score = 0
  state.right.score = 0
  state.over = false
  resetBall()
}

// ── Update logic (called every frame) ─────────────────────────────────────
function update () {
  // Paddle movement
  if (keys['w'] || keys['W']) state.left.y = Math.max(0, state.left.y - PADDLE_SPEED)
  if (keys['s'] || keys['S']) state.left.y = Math.min(H - PADDLE_H, state.left.y + PADDLE_SPEED)
  if (keys['ArrowUp'])        state.right.y = Math.max(0, state.right.y - PADDLE_SPEED)
  if (keys['ArrowDown'])      state.right.y = Math.min(H - PADDLE_H, state.right.y + PADDLE_SPEED)

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
    ball.vx = Math.abs(ball.vx) * 1.05 // slight speed-up each hit
    ball.x = PADDLE_W + 10 + BALL_SIZE / 2
    // Add spin based on where the ball hit the paddle
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
    checkWin() || resetBall()
  } else if (ball.x > W) {
    state.left.score++
    checkWin() || resetBall()
  }
}

function checkWin () {
  if (state.left.score >= WINNING_SCORE || state.right.score >= WINNING_SCORE) {
    const winner = state.left.score >= WINNING_SCORE ? 'Left' : 'Right'
    statusEl.innerText = `${winner} wins! Press Space to play again`
    state.running = false
    state.over = true
    return true
  }
  return false
}

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

  // Paddles
  ctx.fillStyle = '#fff'
  ctx.fillRect(10, state.left.y, PADDLE_W, PADDLE_H)
  ctx.fillRect(W - PADDLE_W - 10, state.right.y, PADDLE_W, PADDLE_H)

  // Ball
  ctx.beginPath()
  ctx.arc(state.ball.x, state.ball.y, BALL_SIZE, 0, Math.PI * 2)
  ctx.fill()

  // Score display
  scoreEl.textContent = `${state.left.score} : ${state.right.score}`
}

// ── Game loop (60 fps via requestAnimationFrame) ──────────────────────────
function loop () {
  update()
  draw()
  requestAnimationFrame(loop)
}

loop()
console.log('Pear-Pong loaded')
