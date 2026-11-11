FROM node:20-alpine
RUN apk add --no-cache git openssh-client
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY ledger.mjs server.mjs ./
CMD ["node", "server.mjs"]
