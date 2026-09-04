# sing-box VLESS+WS (minimal)

从 [SagerNet/sing-box](https://github.com/SagerNet/sing-box) 指定 tag 编译，仅 VLESS + WebSocket，无 TLS（TLS 放在 Cloudflare）。

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `UUID` | 是 | | VLESS UUID |
| `WS_PATH` | 否 | `/ws` | 必须以 `/` 开头 |
| `LISTEN_PORT` | 否 | `8080` | 与平台端口一致 |
| `MEMORY_MB` | 否 | `128` | 容器内存，单位 MiB；会设置 `GOMEMLIMIT` / `GOGC`，≤255MiB 时 `GOMAXPROCS=1` |
| `LOG_LEVEL` | 否 | `warn` | `error` / `warn` / `info` / `debug` |

平台内存限额请与 `MEMORY_MB` 填同一个数。不要开 mux。

## 本地跑

```bash
docker run --rm -p 8080:8080 \
  -e UUID=00000000-0000-0000-0000-000000000000 \
  -e WS_PATH=/ws \
  -e MEMORY_MB=128 \
  ghcr.io/<owner>/<repo>:latest
```

客户端：VLESS + WS + TLS，SNI/Host 用 Cloudflare 域名，path 与 `WS_PATH` 相同。源站不要再开 TLS。
