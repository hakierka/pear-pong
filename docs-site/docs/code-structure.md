---
sidebar_position: 5
title: Code Structure
---

# Code Structure

The project is intentionally minimal — no frameworks, no build step, no bundler. Just files that do things.

```
pear-pong/
├── index.js         # Pear electron bootstrap
├── index.html       # Game UI + styles
├── app.js           # Everything interesting (game + P2P + leaderboard)
├── package.json     # Pear config + npm dependencies
├── images/          # Screenshots for the README
├── docs-site/       # This documentation (Docusaurus)
└── test/            # Test directory
```

## `index.js` — The entry point

**~10 lines.** This is what Pear runs first. It sets up the electron shell using `pear-electron` and `pear-bridge`, then loads `index.html`.

You almost never need to touch this file. It's boilerplate from `pear init`.

## `index.html` — The UI shell

**~70 lines.** Contains:
- The game canvas (800×400)
- Status bar (connection state, game messages)
- Score display
- Controls hint
- Leaderboard div
- All styles (inline CSS — no external sheets)

The neon green theme is all in the `<style>` block. The actual game logic is loaded via `<script type="module" src="./app.js">`.

## `app.js` — The brain

**~410 lines.** This is where all the action is. It's organized into clear sections:

| Section | What it does |
|---------|-------------|
| **DOM refs** | Grab canvas, status elements, etc. |
| **Constants** | Game dimensions, speeds, winning score |
| **Roles** | `isPlayer1`, `role`, `peer` variables |
| **Leaderboard** | Corestore setup, `recordMatch()`, `readAllMatches()`, `renderLeaderboard()` |
| **Game state** | Paddle positions, ball position/velocity, scores, flags |
| **Input tracking** | Keyboard event listeners, serve/reset logic |
| **Networking** | `send()`, `onData()` message router |
| **Hyperswarm** | Topic join, connection handler, role assignment |
| **Game logic** | `serve()`, `resetBall()`, `resetGame()`, `update()`, `checkWin()` |
| **Network sync** | `setInterval` broadcasting state at 60Hz |
| **Draw** | Canvas rendering — paddles, ball, center line |
| **Game loop** | `requestAnimationFrame` loop |

### Why one file?

For a project this size, splitting into modules adds complexity without real benefit. One file means you can read the entire app top-to-bottom and understand the full flow. That's the educational goal.

If you were scaling this up (more game modes, spectator support, etc.), you'd want to split into `game.js`, `network.js`, `leaderboard.js`, etc.

## `package.json` — Config + deps

The `pear` section configures the desktop app:

```json
{
  "pear": {
    "name": "pear-pong",
    "pre": "pear-electron/pre",
    "gui": {
      "width": 850,
      "height": 650
    }
  }
}
```

Dependencies:
- `hyperswarm` — peer discovery and connections
- `corestore` — manages Hypercore storage
- `b4a` — buffer utilities (Buffer ↔ string)
- `hypercore-id-encoding` — encode/decode Hypercore keys
- `pear-bridge` + `pear-electron` — desktop app shell
