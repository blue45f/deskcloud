# DeskCloud monorepo API image.
#
# Build with the repository root as context and pass:
#   PACKAGE=@surveydesk/api
#   APP_DIR=desks/surveydesk/apps/api
FROM node:24-alpine AS builder

RUN corepack enable
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1

COPY . .

RUN pnpm install --frozen-lockfile

ARG PACKAGE
ARG APP_DIR

RUN test -n "$PACKAGE" && test -n "$APP_DIR"
RUN pnpm exec turbo run build --filter="$PACKAGE"

FROM node:24-alpine AS runtime

RUN corepack enable
ENV NODE_ENV=production
ENV PORT=4000
ENV PGLITE_DIR=/data/pglite

ARG APP_DIR
ENV APP_DIR=$APP_DIR

WORKDIR /app
COPY --from=builder /app ./

RUN test -n "$APP_DIR" \
  && mkdir -p /data/pglite \
  && chown -R node:node /data

USER node
EXPOSE 4000
CMD ["sh", "-c", "node \"$APP_DIR/dist/main.js\""]
