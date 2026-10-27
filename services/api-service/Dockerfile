FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package*.json ./
COPY services/api-service/package*.json ./services/api-service/
COPY services/notification-service/package*.json ./services/notification-service/
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm install

# Copy service source and Prisma schema
COPY services/api-service ./services/api-service
COPY tsconfig.json ./

WORKDIR /app/services/api-service

# Generate Prisma Client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY services/api-service/package*.json ./services/api-service/
RUN npm install --omit=dev --workspace=@tasksync/api-service

COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/services/api-service/dist ./services/api-service/dist
COPY --from=builder /app/services/api-service/prisma ./services/api-service/prisma

WORKDIR /app/services/api-service

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
