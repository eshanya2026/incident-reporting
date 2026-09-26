FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Uploaded attachments live here (mounted as a volume); the app runs as the unprivileged "node" user
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 2006
CMD ["node", "dist/server.js"]
