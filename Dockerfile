FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Copy Supervisor
COPY src/supervisor/dist/ /opt/supervisor/
COPY src/supervisor/package.json /opt/supervisor/
COPY src/supervisor/node_modules/ /opt/supervisor/node_modules/

# Create workspace directories
RUN mkdir -p /workspace/inbox /workspace/outbox /workspace/experiment /workspace/supervisor

WORKDIR /workspace

EXPOSE 8080

ENTRYPOINT ["node", "/opt/supervisor/server.js"]
