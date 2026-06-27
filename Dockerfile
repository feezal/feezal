# ── Stage 1: build the frontend ───────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

# Branch, tag, or commit SHA to build from.
# Local builds use master; CI release workflow passes the version tag.
ARG GIT_REF=master

WORKDIR /build

# Clone directly from GitHub so the @feezal element packages are always real
# files — no NTFS junctions, no symlink issues regardless of build host OS.
RUN apk add --no-cache git && \
    git clone --depth 1 --branch "${GIT_REF}" https://github.com/feezal/feezal.git .

RUN cd server; npm install --loglevel=info; cd ..
RUN cd www; npm install --loglevel=info; cd ..
RUN node scripts/generate-elements.js
RUN cd www; npm run build; cd ..
#RUN npm install --loglevel=info

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:22-alpine

LABEL org.opencontainers.image.title="feezal" \
      org.opencontainers.image.description="WYSIWYG dashboard builder powered by Web Components and MQTT" \
      org.opencontainers.image.source="https://github.com/feezal/feezal" \
      org.opencontainers.image.licenses="GPL-3.0"

WORKDIR /app

# git is required at runtime for per-site version history (A7).
RUN apk add --no-cache git

COPY --from=frontend-builder /build/ ./

VOLUME ["/data"]

ENV FEEZAL_PORT=3000 \
    FEEZAL_DATA=/data

EXPOSE 3000

CMD ["npm", "start"]
