FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

# Cache deps layer
COPY package.json ./
RUN npm install --omit=dev && npm install --no-save typescript tsx

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# Strip dev deps after build
RUN npm prune --omit=dev

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    HTTP_PORT=7821 \
    DESIGNS_DIR=/data/designs

EXPOSE 7821
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:7821/health || exit 1

CMD ["node", "dist/server.js"]
