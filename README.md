# Prometheus

A tokenization and embedding library built on PyTorch. Prometheus provides clean, educational implementations of token-level operations — each file pairs mathematical formulas with minimal, readable code.

> *Prometheus* — from Greek Προμηθεύς (forethought). The titan who brought fire to humanity, fitting for a library that transforms raw text into the representations that ignite language models.

## Install

```bash
pip install prometheus
```

Requires Python >= 3.14 and PyTorch >= 2.10.

## Quick Start

```python
import torch
from prometheus import Module, Parameter
```

## Available Components

### Base Types

```python
from prometheus import Module, ModuleList, ModuleDict, Parameter
```

## Roadmap

| Package | Status | Components |
| ------- | ------ | ---------- |
| `tokenization/` | Planned | BPE, WordPiece, SentencePiece, Unigram |
| `embedding/` | Planned | Token Embedding, Positional Encoding, RoPE, ALiBi |
| `encoding/` | Planned | One-Hot, Label Encoding, Byte-Level |

## License

[Apache 2.0](LICENSE)
