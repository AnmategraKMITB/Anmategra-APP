# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build ----------
FROM base AS build
COPY . .

ENV SKIP_ENV_VALIDATION=1

# Variabel NEXT_PUBLIC_* di-inline saat build, bukan dibaca saat runtime, jadi
# harus tersedia di stage ini. Kalau tidak, menyetelnya di runtime tidak
# berpengaruh sama sekali.
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

RUN npm run build

# ---------- Production ----------
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
