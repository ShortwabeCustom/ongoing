#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${PM2_APP_NAME:-uix-torrax-cloud}"

echo "Deploying ${APP_NAME} with PM2"

echo "Installing dependencies"
npm ci

echo "Generating Prisma client"
npm exec -- prisma generate

echo "Building Next.js"
npm run build

echo "Applying database migrations (general deploy step; P1-B adds no migration)"
npm exec -- prisma migrate deploy

echo "Starting ${APP_NAME}"
pm2 restart ecosystem.config.js --only "${APP_NAME}" --update-env

echo "Saving PM2 process list"
pm2 save

echo "Deployment complete"
