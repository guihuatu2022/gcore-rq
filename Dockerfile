# syntax=docker/dockerfile:1

ARG SING_BOX_VERSION=v1.12.11
ARG GO_VERSION=1.24

FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine AS builder
ARG SING_BOX_VERSION
ARG TARGETOS
ARG TARGETARCH
ARG GOPROXY=https://proxy.golang.org,direct

ENV CGO_ENABLED=0 \
    GOOS=${TARGETOS} \
    GOARCH=${TARGETARCH} \
    GOPROXY=${GOPROXY}

RUN apk add --no-cache git ca-certificates

WORKDIR /src
RUN git clone --depth 1 --branch "${SING_BOX_VERSION}" \
      https://github.com/SagerNet/sing-box.git .

# 服务端 VLESS+WS 不需要 gVisor/QUIC/WireGuard/Clash/ACME/Reality
RUN VERSION="$(go run ./cmd/internal/read_tag)" \
 && COMMIT="$(git rev-parse --short HEAD)" \
 && go build -trimpath \
      -ldflags "-X github.com/sagernet/sing-box/constant.Version=${VERSION} -s -w -buildid=" \
      -o /out/sing-box \
      ./cmd/sing-box

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 -s /sbin/nologin app \
 && rm -rf /var/cache/apk/*

COPY --from=builder /out/sing-box /usr/local/bin/sing-box
COPY config.template.json /etc/sing-box/config.template.json
COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh /usr/local/bin/sing-box

USER app
ENV LISTEN_PORT=8080 \
    WS_PATH=/ws \
    MEMORY_MB=128 \
    LOG_LEVEL=warn

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
