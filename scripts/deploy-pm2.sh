#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${PM2_APP_NAME:-uix-torrax-cloud}"

echo "Deploying ${APP_NAME} with PM2"

echo "Stopping ${APP_NAME} before rebuilding .next"
pm2 stop "${APP_NAME}"

echo "Installing dependencies"
pnpm install --frozen-lockfile --prod=false

echo "Generating Prisma client"
pnpm exec prisma generate

echo "Building Next.js"
pnpm build

echo "Applying database migrations"
pnpm exec prisma migrate deploy

echo "Starting ${APP_NAME}"
pm2 restart "${APP_NAME}" --update-env

echo "Saving PM2 process list"
pm2 save

echo "Deployment complete"
