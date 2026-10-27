# 不使用 Docker 部署（1Panel / 内网 IP / FRP）

应用本身可直接运行在服务器上，使用 Python 和 SQLite，无需 Docker、npm build 或 pip 安装依赖。账号、文档和同步需要运行 `server.py`；只把 HTML 放进“静态网站”目录，无法提供这些功能。

## 1. 上传并直接启动

将 GitHub 仓库完整下载、解压到服务器，例如 `/opt/paper-bound`。保留 `fonts/`、`data/`、`vendor/` 和 `release.json`。确认宿主机有 Python 3.10 或更新版本：

```sh
python3 --version
cd /opt/paper-bound
NOTES_HOST=0.0.0.0 NOTES_PORT=8080 sh start.sh
```

打开 `http://内网IP:8080`，首次创建管理员。启动命令会占用当前终端；需要关掉终端仍持续运行，请配置下一节的服务。HTTP 内网访问和 HTTPS 公网访问都使用同一套程序，分别登录同一个账号即可看到同一份文档。

`start.sh` 默认监听 `127.0.0.1:8080`；内网 IP、FRP 或桥接容器连接宿主机时，需要设置 `NOTES_HOST=0.0.0.0`。无需执行 `chmod`，使用 `sh start.sh` 即可。

## 2. 配置宿主机开机自启

适用于采用 systemd 的 Linux。以下以 `/opt/paper-bound` 为程序目录、`/var/lib/paper-bound` 为数据目录。若已有文档，先按“更新与迁移”备份和迁移，避免切换数据目录后误以为文档消失。

```sh
sudo useradd --system --user-group --home-dir /var/lib/paper-bound --no-create-home paper-bound
sudo install -d -o paper-bound -g paper-bound -m 700 /var/lib/paper-bound
sudo cp /opt/paper-bound/deploy/paper-bound.service /etc/systemd/system/paper-bound.service
sudo systemctl daemon-reload
sudo systemctl enable --now paper-bound
sudo systemctl status paper-bound
```

程序目录及其父目录须允许服务用户读取和进入。若系统上已存在 `paper-bound` 用户，跳过 `useradd`。服务监听 `0.0.0.0:8080`，可直接从内网访问。自定义安装目录时，同时修改服务文件的 `WorkingDirectory`、`ExecStart`，以及数据目录相关配置。

查看日志和重启：

```sh
sudo journalctl -u paper-bound -n 80 --no-pager
sudo systemctl restart paper-bound
```

## 3. 1Panel 与 FRP 如何连接

可以让 FRP 直接转发至内网服务器的 `8080` 端口，保留现有公网 HTTPS 入口。应用不要求公网域名，只要浏览器能访问该 IP 和端口即可。

若需要通过 1Panel 的网站入口访问：

1. 应用用上面的宿主机 Python 服务运行，不需要再创建 Python 运行环境容器。
2. 在 1Panel 中创建“反向代理”网站，将整个 `/` 转发至 `http://内网服务器IP:8080`，包含页面、JS/CSS 和 `/api/`。
3. 保留原始 `Host`（包含访问端口），关闭站点/CDN的页面与 JS/CSS 强缓存。项目自带应用资源更新校验。
4. 公网 HTTPS 可继续由现有公网机器处理，FRP 负责将请求送回同一个内网服务。

1Panel 的 OpenResty 若在桥接容器中运行，容器里的 `127.0.0.1` 不等于宿主机地址；使用可达的内网 IP 和端口。若 Nginx 本身就在宿主机，或使用宿主机网络，则可以使用 `127.0.0.1:8080`。

`nginx-location.conf` 提供“整个网站代理”的参考。修改上游地址以符合实际网络；不要把这个 `location /` 再叠加到已有同名区块后面。面板生成的配置应优先通过面板修改。

外层 HTTPS 代理必须保留原始 Host。例如在公网代理里，`proxy_set_header Host $http_host;`；不要把 Host 改成内网 IP，同时保留公网 Origin，否则写入请求会被来源校验拒绝。

## 4. 内网 HTTP 与公网 HTTPS 同时访问

提供的原生服务配置设置 `NOTES_SECURE_COOKIES=0`，让内网 HTTP 可以保存登录 Cookie。它仍使用 HttpOnly 和 SameSite=Lax。不要在同时使用 HTTP 的情况下改成 `1`，否则 HTTP 入口无法保持登录。公网入口仍应使用 HTTPS。

内网 IP 与公网 IP 是不同站点地址，浏览器 Cookie 和本机缓存互不共享，需要分别登录；服务器账号和文档是同一套。暂不登录的本机笔记不会跨站点自动出现，可导出 JSON 后导入，或登录原地址上传。

## 5. 核对运行版本

```sh
curl http://127.0.0.1:8080/api/version
curl http://127.0.0.1:8080/api/session
```

版本接口返回 `version`、`build`、`filesValid`、`changedFiles`、`restartRequired`。完整发行版应满足 `filesValid: true`、`restartRequired: false`。`changedFiles` 表示漏传或混用的文件；`restartRequired: true` 表示磁盘文件与当前进程启动时的版本不同，需要重启。

从浏览器分别访问 `http://内网IP:端口/api/version` 和公网地址下的 `/api/version`。两者应得到相同的版本和 build。若出现 HTML、404、405 或网关错误，说明请求没有进入同一个应用服务；优先核对代理、端口与运行进程。

## 6. 更新与迁移

更新前备份数据库。若采用服务模板，数据目录为 `/var/lib/paper-bound`；手动启动默认在项目内的 `storage/`。可以先停止服务，然后备份整个数据目录，再替换源码和重启。更新时保留数据目录；不要用仓库中的空目录覆盖已有数据库。

从容器迁移到原生时，先停止原容器，再复制它实际使用的数据卷中的 `notes.sqlite3` 及相关 SQLite 文件到新的数据目录，并赋予 `paper-bound` 用户读写权限。不要直接丢弃旧卷或另建一个空数据库后删除旧数据。

Git 安装可更新：

```sh
cd /opt/paper-bound
git pull --ff-only
sudo systemctl restart paper-bound
curl http://127.0.0.1:8080/api/version
```

ZIP 上传安装则完整替换应用源码、资源和 `release.json`，保留数据库，再重启。不要只替换 HTML；Python 服务也必须更新。容器安装如继续使用，需要先拉取代码再执行 `docker compose up -d --build`，只重启旧容器不会加载新源码。

当前服务适合个人及小规模单实例使用；SQLite 文件不要由多台实例同时写入。本次提供并测试了 Python 服务和浏览器功能，systemd/1Panel/FRP 的真实服务器配置须在你的机器上核对，本机未运行这些服务。
