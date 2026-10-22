# JMeet 一键部署手册

本目录支持同一套源码分别部署到公网和纯内网环境。两种模式共用基础服务，通过不同的 Compose 覆盖文件、环境变量和 Caddy 配置区分。

## 目录说明

```text
deployment/
├── docker-compose.yml             # 公共服务：JMeet、LiveKit、MongoDB、Redis
├── docker-compose.public.yml      # 公网 HTTPS 入口
├── docker-compose.intranet.yml    # 内网 HTTPS 入口
├── Caddyfile.public               # 公网证书自动签发
├── Caddyfile.intranet             # 内网 CA 证书
├── .env.public.example            # 公网配置模板
├── .env.intranet.example          # 内网配置模板
└── deploy.sh                      # 统一部署脚本
```

公网和内网使用 `jmeet-public`、`jmeet-intranet` 两个独立 Compose 项目名，容器和数据卷不会混用。如果部署在不同服务器上，这个区分仍建议保留。

## 共同要求

- Linux 服务器，推荐 Ubuntu 22.04/24.04
- Docker Engine 24+、Docker Compose v2
- 推荐至少 4 核 CPU、8 GB 内存；正式多人会议建议 8 核、16 GB 以上
- 客户端能够解析会议域名和 RTC 域名
- 摄像头、麦克风和屏幕共享需要安全上下文，因此即使在内网也使用 HTTPS

MongoDB、Redis 和 JMeet 容器内部端口均不对外开放。

## 公网部署

### 1. 准备域名

准备两个域名并将 A 记录直接解析到服务器公网 IPv4，例如：

```text
meet.example.com  A  203.0.113.10
rtc.example.com   A  203.0.113.10
```

如果使用 Cloudflare，应设置为“仅 DNS”，不要开启代理。普通 HTTP CDN 无法代理 WebRTC UDP 媒体流。

### 2. 开放端口

在云安全组和服务器防火墙中开放：

| 协议 | 端口 | 用途 |
|---|---:|---|
| TCP | 80 | 证书签发和 HTTP 跳转 |
| TCP | 443 | JMeet HTTPS 与 LiveKit WSS |
| UDP | 443 | LiveKit TURN/UDP 回退 |
| TCP | 7881 | WebRTC TCP 回退 |
| UDP | 7882 | WebRTC 主媒体通道 |
| UDP | 30000-30100 | TURN 媒体中继 |

服务器位于 NAT 后面时，以上端口需要一一映射到服务器，公网 IP 必须稳定。

### 3. 配置并启动

```bash
cd deployment
cp .env.public.example .env.public
vi .env.public
bash deploy.sh public
```

至少修改：

- `MEET_DOMAIN`、`LIVEKIT_DOMAIN`、`ACME_EMAIL`
- 所有包含 `change-this` 的密码和密钥
- `MEET_IDENTITY_ENCRYPTION_KEY` 建议使用 32 字节随机值
- `LIVEKIT_API_SECRET` 建议至少 32 个字符

生成随机值示例：

```bash
openssl rand -hex 32
```

Caddy 会自动申请并续期受信任的公网证书。启动完成后访问：

```text
https://meet.example.com/meet/
```

## 纯内网部署

纯内网不需要公网 IP、互联网 DNS、ACME 或 WebRTC 公网打洞，但所有参会终端必须能直接访问服务器的内网地址和媒体端口。

### 1. 配置内网 DNS

在企业 DNS 中添加两个记录，例如：

```text
meet.intra.example.com  A  10.20.0.10
rtc.intra.example.com   A  10.20.0.10
```

不建议使用 `.local`，它可能与 mDNS 冲突。没有企业 DNS 时，可在测试终端的 hosts 文件中配置，但正式环境应使用统一 DNS。

### 2. 放通内网端口

在跨网段防火墙或 ACL 中允许客户端访问服务器：TCP 80、443、7881，UDP 443、7882、30000-30100。单一可信局域网内若没有主机防火墙，通常不需要额外 NAT 或端口映射。

### 3. 配置并启动

```bash
cd deployment
cp .env.intranet.example .env.intranet
vi .env.intranet
bash deploy.sh intranet
```

修改两个内网域名、`LIVEKIT_NODE_IP` 和所有 `change-this` 密钥。`LIVEKIT_NODE_IP` 必须填写客户端能够访问的服务器内网固定 IP。内网覆盖配置会关闭公网 IP 探测，并让 LiveKit 明确公布这个内网地址，避免向客户端发布不可达的 Docker 容器地址。

### 4. 信任内网根证书

内网模式由 Caddy 本地 CA 签发证书。首次启动后导出根证书：

```bash
docker compose -p jmeet-intranet \
  --env-file .env.intranet \
  -f docker-compose.yml \
  -f docker-compose.intranet.yml \
  cp caddy:/data/caddy/pki/authorities/local/root.crt ./jmeet-intranet-root.crt
```

将 `jmeet-intranet-root.crt` 通过企业终端管理工具安装到所有电脑和移动设备的“受信任的根证书颁发机构”。未信任时浏览器会告警，摄像头、麦克风或 WebSocket 也可能无法正常工作。

已有企业 CA 时，可将 `Caddyfile.intranet` 中的 `tls internal` 改为企业证书文件，并在 `docker-compose.intranet.yml` 中只读挂载证书目录。

## 部署命令

将 `<环境>` 替换为 `public` 或 `intranet`：

```bash
bash deploy.sh <环境> up         # 构建并启动
bash deploy.sh <环境> ps         # 查看状态
bash deploy.sh <环境> logs       # 持续查看日志
bash deploy.sh <环境> restart    # 重启服务
bash deploy.sh <环境> pull       # 拉取基础镜像
bash deploy.sh <环境> down       # 停止容器，保留数据卷
bash deploy.sh <环境> config     # 展开并检查最终配置
```

脚本发现对应 `.env` 不存在时会从模板自动创建并停止，避免带默认密码直接启动。启动前也会拒绝仍含 `change-this` 的配置。

## 更新与回滚

更新源码后重新构建：

```bash
git pull
cd deployment
bash deploy.sh public up
```

内网环境将 `public` 换成 `intranet`。正式更新前应备份 MongoDB、Redis 和部署目录中的 `.env.*`。执行 `down` 不会删除数据；不要执行 `down -v`，除非明确要清空全部业务数据。

## 验收检查

1. `bash deploy.sh <环境> ps` 显示核心服务正常运行。
2. 浏览器打开会议地址，证书受信任且无安全警告。
3. 两台不同终端加入同一会议，验证音频、视频、屏幕共享和协同白板。
4. 跨网段或公网测试 UDP；再临时禁用 UDP，确认 TCP 回退可用。
5. 检查浏览器控制台和 Caddy、LiveKit 日志中没有连接错误。

## 常见问题

### 页面能打开，但音视频无法连接

通常是 RTC 域名解析、UDP 端口、安全组、NAT 映射或客户端到服务器的路由问题。先检查 `LIVEKIT_DOMAIN`，再检查 LiveKit 日志和 UDP 7882/30000-30100。

### 公网证书申请失败

确认两个域名已解析到本机公网 IP，TCP 80/443 未被其他进程占用，且没有被 CDN 代理。

### 内网浏览器提示证书不安全

必须在每台客户端信任导出的根证书，或者改用企业 CA 签发的证书。只在浏览器中临时忽略警告不能作为正式部署方案。

### 同一台服务器同时运行公网和内网环境

两套项目的数据卷彼此独立，但默认都会占用相同的宿主机端口，因此不能直接同时启动。建议使用两台服务器或两个独立 IP；如必须共机，需要为每套环境分别绑定 IP 并调整端口映射。

### LiveKit 提示 UDP 缓冲区不足

可在 Linux 主机上提高缓冲区并写入系统配置：

```bash
sudo sysctl -w net.core.rmem_max=2500000
sudo sysctl -w net.core.wmem_max=2500000
```
