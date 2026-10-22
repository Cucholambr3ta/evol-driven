# syntax=docker/dockerfile:1.7
#
#   docker build -t evol-driven .
#   docker run --rm -v "$PWD:/work" -v evol-data:/data evol-driven status
#
# The build stage runs the whole CI (lint, types, format, build, tests), so an image only exists
# if everything passes. MemPalace is an external dependency and is not part of the image: inside
# the container `evol memory` reports it as unavailable, and `evol doctor` says so.
# Mount a volume on /data: the gate keys live there (EVOL_CONFIG_DIR) and must survive between runs.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run ci
RUN npm prune --omit=dev

FROM node:${NODE_VERSION}-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && git config --system --add safe.directory '*'
WORKDIR /opt/evol-driven
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/disciplines ./disciplines
COPY --from=build /app/templates ./templates
RUN chmod +x dist/cli.js && ln -s /opt/evol-driven/dist/cli.js /usr/local/bin/evol
ENV EVOL_CONFIG_DIR=/data/config
RUN mkdir -p /data /work && chown -R node:node /data /work
USER node
VOLUME ["/data"]
WORKDIR /work
ENTRYPOINT ["evol"]
CMD ["--help"]
