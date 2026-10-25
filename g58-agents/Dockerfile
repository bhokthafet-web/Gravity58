FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY sql ./sql
COPY public ./public

USER node

EXPOSE 8090
CMD ["node", "src/server.js"]
