# Avito WebSocket Bridge

> Real-time Avito message streaming via Puppeteer + NestJS + WebSocket

A NestJS service that monitors an Avito personal account for new messages using
Puppeteer browser automation and streams them to a frontend client in real time
over WebSocket. Includes Cloudflared tunnel support for external access.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      NestJS App                         │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐   ┌────────────┐  │
│  │BrowserService│───▶│PollingService│──▶│AvitoService│  │
│  │  Puppeteer  │    │  (interval)  │   │(EventEmitter│  │
│  └─────────────┘    └──────────────┘   └─────┬──────┘  │
│                                               │         │
│                                        message│event    │
│                                               ▼         │
│                                    ┌──────────────────┐ │
│                                    │ MessagesGateway  │ │
│                                    │   (Socket.io)    │ │
│                                    └────────┬─────────┘ │
│                                             │           │
│  ┌──────────────┐                           │           │
│  │TunnelService │  cloudflared              │           │
│  │  (optional)  │──────────────────────┐    │           │
│  └──────────────┘                      │    │           │
└───────────────────────────────────────────────────────┘
                                         │    │
                              public URL │    │ WebSocket
                                         ▼    ▼
                                    ┌──────────────┐
                                    │   Browser    │
                                    │  (Frontend)  │
                                    └──────────────┘
```

### Key design decisions

- **`BrowserService`** — single responsibility: Puppeteer lifecycle (launch, login, navigate, close)
- **`PollingService`** — interval-based scraping with deterministic message ID deduplication
- **`AvitoService`** — orchestrator extending `EventEmitter`; owns retry/reconnect logic
- **`MessagesGateway`** — Socket.io gateway; subscribes to `AvitoService` events and broadcasts to all clients
- **`TunnelService`** — optional cloudflared process manager; gracefully skipped if binary absent
- **`RetryStrategy`** — exponential backoff (3s → 6s → 12s → 24s → 48s, max 60s, 5 attempts)

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 9 |
| Docker + Compose | optional |
| cloudflared | optional |

---

## Quick Start (local)

### 1. Clone and install

```bash
git clone <repo-url> avito-ws-bridge
cd avito-ws-bridge
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000

AVITO_LOGIN=your_phone_or_email
AVITO_PASSWORD=your_password

AVITO_TARGET_SENDER=Рушан

PUPPETEER_HEADLESS=true
PUPPETEER_SLOW_MO=0

POLLING_INTERVAL_MS=5000
```

### 3. Build and run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 4. Open the frontend

Navigate to `http://localhost:3000` in your browser.

---

## Cloudflared Tunnel

The tunnel exposes your local server to the internet with a public HTTPS URL.

### Option A — Automatic (built-in)

If `cloudflared` is installed and in your `PATH`, the app starts the tunnel
automatically on boot and logs the public URL:

```
[Bootstrap] Public URL (Cloudflared): https://xxxx-xxxx.trycloudflare.com
```

### Option B — Manual

**Linux / macOS:**
```bash
./scripts/start-tunnel.sh 3000
```

**Windows (PowerShell):**
```powershell
.\scripts\start-tunnel.ps1 -Port 3000
```

### Installing cloudflared

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux:**
```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
```

**Windows:**
Download from [cloudflare/cloudflared releases](https://github.com/cloudflare/cloudflared/releases/latest)
and add to `PATH`.

### Using a fixed tunnel URL

If you have a named Cloudflare tunnel, set it in `.env`:

```env
TUNNEL_URL=https://your-named-tunnel.example.com
```

The app will skip spawning cloudflared and use this URL directly.

---

## Docker

### Production

```bash
# Copy and fill in credentials
cp .env.example .env

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

The container includes:
- System Chromium (no separate download)
- cloudflared binary
- Non-root user for security
- Named volume for Puppeteer session persistence

### Development (hot-reload)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `AVITO_LOGIN` | — | Avito phone or email **(required)** |
| `AVITO_PASSWORD` | — | Avito password **(required)** |
| `AVITO_TARGET_SENDER` | `Рушан` | Sender name to monitor (partial, case-insensitive) |
| `PUPPETEER_HEADLESS` | `true` | Run browser headlessly |
| `PUPPETEER_SLOW_MO` | `0` | Slow down Puppeteer actions (ms) |
| `POLLING_INTERVAL_MS` | `5000` | How often to check for new messages |
| `TUNNEL_URL` | — | Pre-configured public tunnel URL (skips auto-start) |

---

## WebSocket Events

Connect to the server using Socket.io:

```js
const socket = io('http://localhost:3000');
```

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `{ id, sender, text, timestamp, chatUrl }` | New message received |
| `service:status` | `{ isRunning, isAuthenticated, lastPollAt, errorMessage }` | Service status snapshot |
| `service:error` | `{ message, timestamp }` | Recoverable error |
| `service:fatal` | `{ message, timestamp }` | Max retries exceeded |

### Client → Server

| Event | Description |
|-------|-------------|
| `service:getStatus` | Request current status snapshot |

---

## Project Structure

```
src/
├── main.ts                    # Bootstrap + graceful shutdown
├── app.module.ts              # Root module
├── shutdown.service.ts        # Uptime + shutdown logging
├── config/
│   ├── configuration.ts       # Typed config factory
│   └── config.validator.ts    # Startup env validation
├── avito/
│   ├── avito.module.ts
│   ├── avito.service.ts       # Orchestrator + EventEmitter
│   ├── avito.types.ts         # AvitoMessage, AvitoServiceStatus
│   ├── browser.service.ts     # Puppeteer launch + login
│   ├── polling.service.ts     # Message scraping + deduplication
│   └── retry.strategy.ts      # Exponential backoff
├── gateway/
│   ├── gateway.module.ts
│   ├── messages.gateway.ts    # Socket.io WebSocket gateway
│   └── events.ts              # WS event name constants
└── tunnel/
    ├── tunnel.module.ts
    └── tunnel.service.ts      # Cloudflared process manager
public/
└── index.html                 # Frontend (served statically)
scripts/
├── start-tunnel.sh            # Manual tunnel (Linux/macOS)
└── start-tunnel.ps1           # Manual tunnel (Windows)
```

---

## Troubleshooting

**Browser fails to launch in Docker**
Ensure `shm_size: '256mb'` is set in `docker-compose.yml` and
`seccomp:unconfined` is present under `security_opt`.

**Authentication fails**
- Set `PUPPETEER_HEADLESS=false` to watch the login flow visually
- Avito may show a CAPTCHA on first login — solve it manually once,
  then the session cookie persists in the Puppeteer user data directory

**No messages detected**
- Verify `AVITO_TARGET_SENDER` matches the sender name as it appears in Avito
- Increase `POLLING_INTERVAL_MS` if you're hitting rate limits
- Check the NestJS logs for scraping errors

**Tunnel URL not appearing**
- Confirm `cloudflared` is in `PATH`: `cloudflared --version`
- Try running the tunnel manually: `./scripts/start-tunnel.sh`

---

## License

MIT
