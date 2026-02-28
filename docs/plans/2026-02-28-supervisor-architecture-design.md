# Supervisor Architecture Design

**Date**: 2026-02-28
**Status**: Approved
**Scope**: Replace direct SSH-based experiment execution with a Supervisor + Remote Claude Code architecture

## Problem

Stage 5 (Experiment Execution) currently requires local Claude Code to SSH into RunPod pods for every command. This creates:
- No persistent session (cd/env lost between commands)
- Painful code writing via SSH heredoc/SFTP
- No remote code intelligence (can't Read/Edit/Grep remote files)
- Cumulative round-trip latency
- SSH timeout risks during long training runs

## Solution: Remote Claude Code + Supervisor

Instead of SSH MCP, install Claude Code on the remote pod. A lightweight Supervisor HTTP service mediates communication between local CC (boss) and remote CC (employee), decoupled from SSH.

## Architecture

### Roles

| Role | Location | Identity | Responsibility |
|------|----------|----------|----------------|
| User | Local | Boss | Final decision maker |
| Local CC | Local | Secretary | Pod lifecycle, task orchestration, checkpoint planning, Supervisor communication |
| Supervisor | Pod | Receptionist | HTTP service, message routing, CC process management, status monitoring |
| Remote CC | Pod | Employee | Execute experiment per Skill, write reports at checkpoints, exit |

### System Diagram

```
Local CC (boss)                         RunPod Pod (employee)
    │                                      │
    │  ① POST /task                        │
    │  ──────────────────────────────────>  │  Supervisor (HTTP:8080, always-on)
    │                                      │      │
    │                                      │      ▼ spawn
    │                                      │  Remote CC (claude -p "task")
    │                                      │      │
    │                                      │   Execute Phase N...
    │                                      │      │
    │  ② GET /task/:id/status              │      ▼
    │  <──────────────────────────────────  │  Write report → /workspace/outbox/
    │    status: awaiting_approval         │  CC exits (code 0)
    │                                      │      │
    │  User reviews report                 │      │ (blocked, CC not running)
    │                                      │      │
    │  ③ POST /task/:id/feedback           │      │
    │  ──────────────────────────────────>  │      ▼
    │                                      │  claude --resume <id> -p "feedback"
    │                                      │  Continue Phase N+1...
    │         ... cycle ...                │   ... cycle ...
```

## Lifecycle

### Phase 0: Preparation (Local)
Local CC analyzes experiment plan → plans checkpoint list → builds task payload.

### Phase 1: Pod Creation (Local CC → RunPod MCP)
- `create-pod` with pre-built Docker image, expose `8080/http`
- Pod starts → Supervisor auto-starts (Docker ENTRYPOINT)
- Local CC polls `GET /health` until 200

### Phase 2: Task Dispatch (Local CC → Supervisor HTTP)
```
POST /task {
  experimentPlan: "...",
  checkpoints: ["phase_3", "phase_4", "phase_5"],
  envConfig: { ... },
  modelConfig: { provider, model, apiKey, baseUrl }
}
```
Supervisor configures environment → spawns remote CC.

### Phase 3-6: Execution Loop
1. Remote CC executes Phase N
2. At checkpoint → writes report to `/workspace/outbox/` → exits (code 0)
3. Supervisor detects report → status = `awaiting_approval`
4. Local CC polls `GET /status` → discovers `awaiting_approval`
5. Local CC fetches report → shows to user
6. User decides → `POST /feedback { action: "continue" | "revise" | "abort" }`
7. Supervisor resumes CC with `claude --resume <id>` → injects feedback
8. Repeat

### Phase 7: Cleanup
- Remote CC completes all phases → writes final report → exits
- Local CC receives completion signal
- `GET /files` to download results
- RunPod MCP `stop-pod` / `delete-pod`

## HTTP API

### Transport Abstraction Layer

```typescript
interface ITransport {
  sendTask(task: TaskPayload): Promise<string>
  sendFeedback(taskId: string, fb: Feedback): Promise<void>
  getStatus(taskId: string): Promise<TaskStatus>
  getReport(taskId: string): Promise<Report>
  getFiles(taskId: string, filePath: string): Promise<Buffer>
  health(): Promise<HealthInfo>
}
```

Future: swap HTTP implementation for Redis/RabbitMQ without changing upper layers.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| GET | `/health` | Health check | — | `{ status, uptime, ccProcess }` |
| POST | `/task` | Submit task | `TaskPayload` | `{ taskId }` |
| GET | `/task/:id/status` | Check status | — | `{ phase, status, progress }` |
| GET | `/task/:id/report` | Get report | — | `{ report, files[] }` |
| POST | `/task/:id/feedback` | Send feedback | `Feedback` | `{ ack }` |
| GET | `/task/:id/files/:path` | Download file | — | File stream |
| POST | `/task/:id/abort` | Abort task | — | `{ ack }` |

### Data Structures

```typescript
interface TaskPayload {
  experimentPlan: string
  checkpoints: string[]
  envConfig: Record<string, string>
  modelConfig: {
    provider: string
    model: string
    apiKey: string
    baseUrl?: string
  }
  skills?: string[]
}

type TaskStatus = {
  taskId: string
  phase: string
  status: "initializing" | "running" | "awaiting_approval" | "completed" | "failed" | "aborted"
  progress?: string
  error?: string
  startedAt: string
  updatedAt: string
}

interface Report {
  phase: string
  summary: string
  details: string
  files: string[]
  metrics?: Record<string, any>
}

interface Feedback {
  action: "continue" | "revise" | "abort"
  message?: string
}
```

## Supervisor Internals

### Process Management

```
spawn                          resume                        resume
  │                              │                              │
  ▼                              ▼                              ▼
┌─────────┐  exit(0)  ┌──────────────────┐  exit(0)  ┌─────────────────┐
│ CC Run 1 │ ────────► │ checkpoint wait   │ ────────► │ CC Run 2         │ ...
│ Phase 3  │          │ (CC exited,       │          │ Phase 4          │
│          │          │  Supervisor waits │          │                  │
└─────────┘          │  for feedback)    │          └─────────────────┘
                      └──────────────────┘
```

1. **spawn**: `claude -p "$(cat /workspace/inbox/task.md)" --output-format json --allowedTools Bash,Write,Edit,Read,Glob,Grep`
2. **checkpoint detection**: fs.watch on `/workspace/outbox/` directory
3. **resume**: `claude --resume <session-id> -p "$(cat /workspace/inbox/feedback_N.md)" --output-format json --allowedTools Bash,Write,Edit,Read,Glob,Grep`
4. **error handling**: Non-zero exit → capture stderr → status = `failed` → report to local

### Filesystem Convention

```
/workspace/
├── inbox/                    # Local → Remote (Supervisor writes)
│   ├── task.md               # Initial task
│   └── feedback_001.md       # Feedback messages
├── outbox/                   # Remote → Local (CC writes, Supervisor reads)
│   ├── report_phase_3.json   # Phase reports
│   └── report_final.json     # Final report
├── experiment/               # Experiment code and data (CC working directory)
│   ├── model.py
│   ├── train.py
│   ├── eval.py
│   ├── config.yaml
│   ├── train.log
│   └── results/
├── .claude/                  # CC configuration
│   └── settings.json         # Model config, permissions
└── supervisor/               # Supervisor itself
    ├── server.ts
    ├── state.json            # Persisted state
    └── logs/
```

### Checkpoint Mechanism

Checkpoints are **adaptive**: local CC plans them at task dispatch time based on experiment complexity. Default is per-Phase granularity.

The checkpoint list is encoded in the task file (`inbox/task.md`). Remote CC reads the list and knows when to write reports and exit.

## Docker Image

### Dockerfile

```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Node.js (Supervisor needs it)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Supervisor code
COPY src/supervisor/ /opt/supervisor/
RUN cd /opt/supervisor && npm install

# Workspace structure
RUN mkdir -p /workspace/inbox /workspace/outbox /workspace/experiment /workspace/supervisor/logs

# Entrypoint: start Supervisor
ENTRYPOINT ["node", "/opt/supervisor/server.js"]
EXPOSE 8080
```

### Deployment Flow

1. **One-time**: Build + push image to Docker Hub
2. **One-time**: Create RunPod Template via MCP (`create-template`)
3. **Per experiment**: Create Pod via MCP (`create-pod` with template) → Supervisor auto-starts

### Local CC Communication

Local CC uses **Bash + curl** to communicate with Supervisor. No new MCP tools needed.

```bash
curl -s https://<pod-url>/health
curl -s -X POST https://<pod-url>/task -H "Content-Type: application/json" -d @payload.json
curl -s https://<pod-url>/task/<id>/status
curl -s https://<pod-url>/task/<id>/report
curl -s -X POST https://<pod-url>/task/<id>/feedback -d '{"action":"continue"}'
```

## Security

| Risk | Mitigation |
|------|------------|
| API Key exposure | Injected via Pod env vars, not written to disk files. Cleared on Pod destroy |
| Unauthorized Supervisor access | RunPod HTTP ports require Pod ID prefix. Optional Bearer token auth |
| Remote CC privilege escalation | `--allowedTools` restricts to Bash/Write/Edit/Read/Glob/Grep only |

## Fault Tolerance

| Failure | Handling |
|---------|----------|
| Remote CC crash (exit != 0) | Supervisor captures stderr, status = `failed`. Local CC chooses retry or abort |
| Supervisor crash | Docker `--restart=always`. state.json persists for recovery |
| Pod reclaimed by RunPod | Local CC health poll timeout → RunPod MCP confirms Pod status → notify user |
| Training OOM | Remote CC detects OOM → error report to outbox → Supervisor reports → local CC decides |
| Network interruption | curl timeout → retry 3x → fail → notify user |

## Skill Updates

`skill/experiment-execution.md` modifications:
- Phase 2: Use pre-built image + wait for Supervisor `/health`
- Phase 3-6: Communicate via HTTP API, no direct SSH
- New Phase 0: Task orchestration (checkpoint planning + task payload construction)
- Remote CC behavior constrained by task file, no need to install Skills remotely

## Code Inventory

```
src/supervisor/           # NEW (runs on Pod)
├── server.ts             # HTTP service (~200 lines)
├── process-manager.ts    # CC process management (~100 lines)
├── transport.ts          # ITransport interface (~30 lines)
├── state.ts              # State persistence (~50 lines)
├── package.json          # Independent deps (express, zod)
└── tsconfig.json

Dockerfile                # NEW: Pre-built image

skill/experiment-execution.md  # UPDATED
prompt/experiment-task.md      # NEW: Task file template
```

Estimated: ~400-500 lines new code + Skill/Prompt updates.

## Future Evolution

- **Messaging queue**: Swap HTTP transport for Redis/RabbitMQ via ITransport interface
- **Multi-pod parallel**: Multiple Supervisors, local CC orchestrates across pods
- **Wandb/MLflow**: Remote CC integrates experiment tracking
- **Bidirectional streaming**: WebSocket upgrade for real-time training log streaming
