FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Reproducible deps layer: copy lockfile + manifest, then `npm ci`
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Drop dev deps for the runtime layer
RUN npm prune --omit=dev

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    HTTP_PORT=7821 \
    HTTP_HOST=0.0.0.0 \
    DESIGNS_DIR=/data/designs \
    MOCKIT_IN_CONTAINER=1 \
    CLAUDE_BACKEND=cli

EXPOSE 7821
VOLUME ["/data"]

# Make the data dir writable by the non-root user that ships with the
# Playwright base image.
RUN mkdir -p /data/designs && chown -R pwuser:pwuser /data /app
USER pwuser

# Use node's built-in fetch for healthcheck (no wget dependency)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:7821/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
