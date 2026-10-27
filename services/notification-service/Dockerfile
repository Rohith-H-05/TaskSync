FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY services/api-service/package*.json ./services/api-service/
COPY services/notification-service/package*.json ./services/notification-service/
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY services/notification-service ./services/notification-service
COPY services/api-service/prisma ./services/api-service/prisma
COPY tsconfig.json ./

# Generate Prisma Client from api-service schema
RUN npx prisma generate --schema=./services/api-service/prisma/schema.prisma

WORKDIR /app/services/notification-service
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY services/notification-service/package*.json ./services/notification-service/
RUN npm install --omit=dev --workspace=@tasksync/notification-service

COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist

WORKDIR /app/services/notification-service

CMD ["node", "dist/index.js"]
