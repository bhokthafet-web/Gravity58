FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

RUN mkdir -p /data/media && chown -R node:node /app /data
USER node

EXPOSE 8088
CMD ["node", "src/server.js"]
