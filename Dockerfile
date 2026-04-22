FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY appHelpers.js server.js ./
COPY models ./models
COPY public ./public
COPY views ./views
COPY data ./data

EXPOSE 3000

CMD ["node", "server.js"]
