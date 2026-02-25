# Experiment Design (Skeleton)

Design an experiment plan for a selected research idea. This is Stage 4 of the research pipeline.

> **Status**: Skeleton. Execution capabilities (Pod integration) planned for future phase.

## Input

- Selected idea from Stage 3 (Idea Generation)
- Literature survey notes (for baselines and datasets)

## Process

### 1. Define Research Question

Formalize the idea into a testable hypothesis:
- What exactly are we testing?
- What is the expected outcome?
- What would constitute success vs. failure?

### 2. Design Methodology

- Core method: what algorithm/architecture/approach
- Key design choices and justifications
- What existing code/frameworks to build on

### 3. Identify Evaluation Setup

- **Datasets**: which benchmarks, any new data needed
- **Baselines**: which existing methods to compare against (from literature survey)
- **Metrics**: primary and secondary evaluation metrics
- **Ablations**: what components to test individually

### 4. Estimate Resources

- Compute: GPU type, estimated training time, number of runs
- Data: storage, preprocessing requirements
- Timeline: rough phases (implement → train → evaluate → write)

> **Future**: This section will feed into Pod integration (auto-provision GPU via RunPod).

### 5. Compile Output

```
## Experiment Plan: [idea title]

### Hypothesis
[one clear sentence]

### Method
[description of approach]

### Evaluation
- Datasets: [list]
- Baselines: [list]
- Metrics: [list]
- Ablations: [list]

### Resources
- GPU: [type × count × hours]
- Storage: [estimate]
- Frameworks: [PyTorch, etc.]

### Risks
[what could go wrong, mitigation strategies]
```

## Next Steps (Future)

When Pod integration is available:
1. `pod_create` with estimated GPU requirements
2. SSH into pod, set up environment
3. Execute experiment
4. `pod_destroy` when done
5. Analyze results → write paper

## Validation Checkpoint (Mandatory)

After completing the experiment plan, run stage-end validation:

1. Load `prompt/validate-experiment.md`, replace `{{EXPERIMENT_OUTPUT}}` with the full experiment plan
2. Call `pplx_deep_research` with the filled prompt
3. Parse the JSON response and process issues:
   - **CRITICAL**: HALT. Key baseline missing, fundamentally flawed design, or unrealistic resource estimate. Report to user.
   - **WARNING**: Auto-fix — add missing baselines/metrics, adjust estimates. Re-check with `pplx_ask` (max 2 rounds).
   - **INFO**: Log and incorporate.
4. This is the final stage. After validation, deliver the complete research output to the user.

## Tool Priority Reminder

```
Priority 4 (expensive): pplx_deep_research — exactly 1x (mandatory validation)
```
