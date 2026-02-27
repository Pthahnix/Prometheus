# Experiment Execution

Execute an experiment on a remote GPU pod. This is Stage 5 of the research pipeline.

## Input

- Completed Experiment Plan from Stage 4 (hypothesis, method, datasets, baselines, metrics, resources, risks)
- User confirmation to proceed (this stage costs real money)

## Prerequisites

- RunPod MCP available (@runpod/mcp-server configured in .mcp.json)
- Bash tool available for SSH/SFTP
- Prompts: `prompt/hardware-estimation.md`, `prompt/environment-setup.md`
- Environment: `API_KEY_RUNPOD` set in .env

## Overview

Seven-phase sequential pipeline. Code is written directly on the RunPod machine (not uploaded from local). Datasets are downloaded on-pod via HuggingFace. Only results are transferred back to local via SFTP.

**Critical safety rule**: Once a pod is created (Phase 2), ALL subsequent failures MUST still execute Phase 7 (Cleanup) before stopping. Never leave a pod running unattended — it costs money.

## Execution State

Maintain these variables throughout execution:

```typescript
podId: string               // RunPod pod ID (set in Phase 2)
sshHost: string             // Public IP for SSH (set in Phase 2)
sshPort: number             // Mapped SSH port (set in Phase 2)
hardware: HardwareEstimate  // GPU config (set in Phase 1)
experimentName: string      // Derived from Experiment Plan title
workDir: string             // /workspace/experiment (remote)
localResultsDir: string     // ./results/<experimentName> (local)
```

---

## Phase 1: Hardware Estimation

1. Load `prompt/hardware-estimation.md`
2. Feed the Experiment Plan's method, datasets, resources sections as input
3. Produce hardware estimate JSON: gpuType, gpuCount, estimatedHours, estimatedCost, diskEstimate, dockerImage
4. Present to user in a clear table:

```
GPU 配置估算:
  GPU: NVIDIA A100 80GB PCIe × 1
  预估时长: 12 小时
  预估费用: ~$19.68
  磁盘: 50 GB
  替代方案: H100 80GB ($26.32, 快 40%)
```

5. **USER CONFIRMATION GATE**: Ask user to confirm budget. If declined, STOP.

---

## Phase 2: Pod Provisioning

1. Call RunPod MCP `create-pod`:
   - name: `prometheus-<experimentName>`
   - imageName: from hardware estimate dockerImage
   - gpuTypeId: from hardware estimate gpuType (the RunPod gpuTypeId string)
   - gpuCount: from hardware estimate
   - volumeInGb: from hardware estimate diskEstimate_GB
   - ports: ["22/tcp"]
   - containerDiskInGb: 20

2. Record `podId` from response

3. Poll RunPod MCP `get-pod` (podId) every 15 seconds:
   - Max wait: 5 minutes (20 polls)
   - Look for: runtime status == "RUNNING"
   - On timeout: report error, call `delete-pod`, STOP

4. Extract SSH connection from get-pod response:
   - Find the port mapping for 22/tcp → get public IP and external port
   - Set `sshHost` and `sshPort`

5. Verify SSH connectivity:
   ```bash
   ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${sshHost} -p ${sshPort} 'echo "SSH OK"'
   ```
   - Retry up to 3 times with 10s wait (pod may need SSH daemon startup time)
   - On failure: report error, execute Phase 7, STOP

---

## Phase 3: Environment Setup

1. Verify GPU:
   ```bash
   ssh root@${sshHost} -p ${sshPort} 'nvidia-smi'
   ```

2. Load `prompt/environment-setup.md`, feed: hardware config, Experiment Plan frameworks/libraries/data sources

3. Execute the generated command sequence line-by-line via SSH:
   ```bash
   ssh root@${sshHost} -p ${sshPort} '<command>'
   ```

4. If any command fails: diagnose, fix, retry. Max 3 retries per command.

5. **Conditional — local dataset upload**:
   IF user has specified local dataset files:
   ```bash
   sftp -P ${sshPort} root@${sshHost} <<EOF
   mkdir /workspace/experiment/data
   put -r <local_dataset_path> /workspace/experiment/data/
   EOF
   ```
   ELSE: skip (datasets will be downloaded via HuggingFace in Phase 4)

6. Create workspace:
   ```bash
   ssh root@${sshHost} -p ${sshPort} 'mkdir -p /workspace/experiment'
   ```

---

## Phase 4: Code Implementation

Claude Code acts as a remote developer. Based on the Experiment Plan, write all experiment code directly on the RunPod machine via SSH.

### 4.1 Write Model Code

```bash
ssh root@${sshHost} -p ${sshPort} 'cat > /workspace/experiment/model.py << "PYEOF"
<model code based on Experiment Plan method section>
PYEOF'
```

The model code should implement:
- Core architecture described in the Experiment Plan
- Use HuggingFace transformers / torch as appropriate
- Keep it minimal and focused on the hypothesis being tested

### 4.2 Write Training Script

```bash
ssh root@${sshHost} -p ${sshPort} 'cat > /workspace/experiment/train.py << "PYEOF"
<training script>
PYEOF'
```

The training script should include:
- Dataset loading (HuggingFace datasets or custom)
- Training loop (or HuggingFace Trainer)
- Checkpoint saving (best model + periodic)
- Metrics logging to stdout and to file
- A `--max-steps` flag for dry-run support
- Resume from checkpoint support

### 4.3 Write Evaluation Script

```bash
ssh root@${sshHost} -p ${sshPort} 'cat > /workspace/experiment/eval.py << "PYEOF"
<evaluation script>
PYEOF'
```

Implements:
- Load best checkpoint
- Run on test/validation set
- Compute all metrics from Experiment Plan
- Output results as JSON to /workspace/experiment/metrics/results.json

### 4.4 Write Config

```bash
ssh root@${sshHost} -p ${sshPort} 'cat > /workspace/experiment/config.yaml << "YAMLEOF"
<hyperparameters and paths>
YAMLEOF'
```

### 4.5 Dry-Run Validation

```bash
ssh root@${sshHost} -p ${sshPort} 'cd /workspace/experiment && python train.py --max-steps 10'
```

Verify:
- Dataset loads successfully
- Model forward pass works
- Loss computes and backpropagates
- No OOM errors
- Checkpoint saving works

If dry-run fails: diagnose the error, fix the code, retry. Max 3 fix-retry cycles.
If still failing after 3 attempts: report to user, ask whether to continue or abort (→ Phase 7).

---

## Phase 5: Experiment Run

### 5.1 Start Training

```bash
ssh root@${sshHost} -p ${sshPort} 'cd /workspace/experiment && tmux new-session -d -s train "python train.py 2>&1 | tee train.log"'
```

### 5.2 Monitor Progress

Periodically check training status:
```bash
ssh root@${sshHost} -p ${sshPort} 'tail -30 /workspace/experiment/train.log'
```

Check for:
- Loss is decreasing (training is progressing)
- No NaN or Inf values
- GPU utilization is reasonable (via `nvidia-smi`)
- Training is still running (`tmux has-session -t train`)

Monitoring interval: check every few minutes for short jobs, less frequently for long jobs.

### 5.3 Failure Handling

- **OOM**: Reduce batch_size in config, restart training
- **NaN loss**: Lower learning_rate, restart from last checkpoint
- **Process crash**: Check error in train.log, fix code if needed, resume from checkpoint
- **Stuck (no progress for 30+ minutes)**: Investigate GPU utilization, kill and restart

Max recovery attempts: 3. If unrecoverable: save whatever results exist, proceed to Phase 6.

### 5.4 Training Complete

When training finishes:
```bash
ssh root@${sshHost} -p ${sshPort} 'cd /workspace/experiment && python eval.py'
```

Report final metrics to user.

---

## Phase 6: Result Collection

### 6.1 Create Local Directory

```bash
mkdir -p ./results/${experimentName}/{logs,metrics,checkpoints,src}
```

### 6.2 Download via SFTP

```bash
sftp -P ${sshPort} root@${sshHost} << EOF
get /workspace/experiment/train.log ./results/${experimentName}/logs/
get -r /workspace/experiment/metrics/ ./results/${experimentName}/metrics/
get /workspace/experiment/model.py ./results/${experimentName}/src/
get /workspace/experiment/train.py ./results/${experimentName}/src/
get /workspace/experiment/eval.py ./results/${experimentName}/src/
get /workspace/experiment/config.yaml ./results/${experimentName}/src/
EOF
```

### 6.3 Checkpoints (optional)

Ask user: "是否下载模型 checkpoints？(可能很大: ~{size}GB)"
If yes:
```bash
sftp -P ${sshPort} root@${sshHost} << EOF
get -r /workspace/experiment/checkpoints/ ./results/${experimentName}/checkpoints/
EOF
```

---

## Phase 7: Cleanup

### 7.1 Stop Pod

Call RunPod MCP `stop-pod` with podId.

### 7.2 Delete Pod

Ask user: "Pod 已停止。是否删除？（删除后数据不可恢复）"
If confirmed: call RunPod MCP `delete-pod` with podId.
If declined: inform user the pod is stopped but still incurring storage costs.

### 7.3 Experiment Summary

Output a final summary:

```
## 实验完成: <experimentName>

### 结果
- 关键指标: <metrics from eval.py>

### 资源消耗
- 总运行时间: <hours>
- 预估费用: ~$<cost>
- GPU: <type> × <count>

### 本地文件
- 结果目录: ./results/<experimentName>/
- 日志: ./results/<experimentName>/logs/
- 指标: ./results/<experimentName>/metrics/
- 代码: ./results/<experimentName>/src/

### Pod 状态
- Pod ID: <podId>
- 状态: <已删除 / 已停止>
```

---

## Error Recovery Matrix

| Phase | Error | Action |
|-------|-------|--------|
| 2 | Pod creation fails | Report to user, STOP |
| 2 | Pod timeout (not RUNNING in 5min) | Delete pod, STOP |
| 2 | SSH connection fails | Retry 3×, then delete pod, STOP |
| 3 | Dependency install fails | Diagnose, fix, retry 3× |
| 4 | Dry-run fails | Fix code, retry 3×, ask user |
| 5 | OOM | Reduce batch size, restart |
| 5 | NaN loss | Lower LR, restart from checkpoint |
| 5 | Process crash | Fix code, resume from checkpoint |
| Any | Unrecoverable error | Save partial results → Phase 6 → Phase 7 |

**Golden rule**: Phase 7 ALWAYS runs if Phase 2 succeeded. No exceptions.
