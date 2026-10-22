# ====================================================
# Stage 1: builder
# ====================================================
FROM node:24.15.0 AS builder

# Define pnpm version as build argument with default value
ARG PNPM_VERSION=11.8.0
ARG INSTALL_SAFE_CHAIN=false
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN pnpm config set registry ${NPM_REGISTRY}

WORKDIR /app

# Create necessary directories
RUN mkdir -p meet-ce/typings meet-ce/frontend meet-ce/backend && \
    chown -R node:node .

USER node

# Optional supply-chain check. It is disabled by default so private/offline
# deployments do not require access to GitHub during the image build.
RUN if [ "${INSTALL_SAFE_CHAIN}" = "true" ]; then \
      curl -fsSL https://github.com/AikidoSec/safe-chain/releases/latest/download/install-safe-chain.sh | sh -s -- --ci && \
      /home/node/.safe-chain/bin/safe-chain-verify; \
    fi
# ---------------------

# =============================================================================
# Workspace Configuration for Docker/CI
# =============================================================================

# Copy workspace configuration files
COPY --chown=node:node pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --chown=node:node package.json pnpm-lock.yaml ./

# Copy package.json files for all workspace packages
COPY --chown=node:node meet-ce/typings/package.json ./meet-ce/typings/
COPY --chown=node:node meet-ce/frontend/package.json ./meet-ce/frontend/
COPY --chown=node:node meet-ce/frontend/projects/shared-meet-components/package.json ./meet-ce/frontend/projects/shared-meet-components/
COPY --chown=node:node meet-ce/backend/package.json ./meet-ce/backend/
# Copy the source code for all packages
COPY --chown=node:node meet-ce/typings/ ./meet-ce/typings/
COPY --chown=node:node meet-ce/frontend/ ./meet-ce/frontend/
COPY --chown=node:node meet-ce/backend/ ./meet-ce/backend/

# Copy additional necessary files
COPY --chown=node:node meet.sh .

ARG BASE_HREF=/

# Build the deployable SPA and backend
RUN pnpm install --frozen-lockfile && \
    pnpm run build:typings && \
    pnpm run build:backend && \
    pnpm run build:shared-components && \
    pnpm --filter @openvidu-meet/frontend run build "${BASE_HREF}"

# Clean up development dependencies and unnecessary files
# Keep backend node_modules for production stage
RUN rm -rf node_modules \
    meet-ce/frontend \
    meet-ce/backend/src \
    meet-ce/backend/openapi \
    meet-ce/backend/index.ts \
    meet-ce/typings/src

# ====================================================
# Stage 2: production
# ====================================================
FROM node:24.15.0-alpine AS production

# Define pnpm version as build argument with default value
ARG PNPM_VERSION=11.8.0
ARG NPM_REGISTRY=https://registry.npmjs.org

# Set pnpm version as environment variable (available at runtime)
ENV PNPM_VERSION=${PNPM_VERSION}
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}

# Install bash (required by meet.sh which uses bash arrays)
RUN apk add --no-cache bash tzdata

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN pnpm config set registry ${NPM_REGISTRY}

WORKDIR /opt/openvidu-meet

#Copy main package.json and pnpm-workspace.yaml
COPY --from=builder --chown=node:node /app/meet.sh ./
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/pnpm-workspace.yaml ./

# Copy the compiled backend with all node_modules from builder
COPY --from=builder --chown=node:node /app/meet-ce/backend/dist ./meet-ce/backend/dist
COPY --from=builder --chown=node:node /app/meet-ce/backend/public ./meet-ce/backend/public
COPY --from=builder --chown=node:node /app/meet-ce/backend/package.json ./meet-ce/backend/package.json

# Copy typings
COPY --from=builder --chown=node:node /app/meet-ce/typings/dist ./meet-ce/typings/dist
COPY --from=builder --chown=node:node /app/meet-ce/typings/package.json ./meet-ce/typings/package.json

# Copy entrypoint script
COPY meet-ce/docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN pnpm install --prod --filter @openvidu-meet/backend --filter @openvidu-meet/typings

# Set permissions
RUN chmod +x /usr/local/bin/entrypoint.sh && \
	chmod +x meet.sh

# Switch to non-root user
USER node

# Environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE $SERVER_PORT

# Start the application
CMD ["/usr/local/bin/entrypoint.sh"]
