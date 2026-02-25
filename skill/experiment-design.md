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
