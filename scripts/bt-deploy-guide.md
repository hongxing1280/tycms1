# 宝塔傻瓜式部署

这套项目是三个服务：

- `sports-web` 公共前台，端口 `3000`
- `sports-admin` 后台，端口 `3001`
- `sports-api` 接口，端口 `4000`

推荐部署方式：

1. 先在宝塔里安装 `Node.js`、`PM2 管理器`、`Nginx`
2. 上传整个项目到服务器，例如 `/www/wwwroot/Sports-mian`
3. 在宝塔的站点里分别创建 3 个域名
4. 给三个域名分别写反向代理
5. 在宝塔计划任务里点一下执行 `scripts/bt-deploy.sh`

## 站点建议

- 主站 `www.pubcms.com` -> `http://127.0.0.1:3000`
- 后台 `admin.pubcms.com` -> `http://127.0.0.1:3001`
- 接口 `api.pubcms.com` -> `http://127.0.0.1:4000`

## 反代要点

所有站点都要保留这几个头：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

## 宝塔里怎么点

### 1. 主站

站点 -> `www.pubcms.com` -> 反向代理

- 目标 URL：`http://127.0.0.1:3000`
- 其余默认即可

### 2. 后台

站点 -> `admin.pubcms.com` -> 反向代理

- 目标 URL：`http://127.0.0.1:3001`

### 3. 接口

站点 -> `api.pubcms.com` -> 反向代理

- 目标 URL：`http://127.0.0.1:4000`

## 最傻瓜的启动方式

宝塔后台 -> 计划任务 -> 添加任务：

- 任务类型：`Shell 脚本`
- 任务名称：`Sports 一键部署启动`
- 执行周期：`手动执行`
- 脚本内容：

```bash
cd /www/wwwroot/Sports-mian
bash scripts/bt-deploy.sh
```

以后部署、重启、更新代码后，都进这个计划任务，点一次 `执行`。

## PM2 启动方式

建议在项目根目录执行一次构建，然后用 PM2 启动：

```bash
pnpm install
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
```

如果宝塔面板里已经有 PM2 入口，也可以直接导入 `ecosystem.config.cjs`。

## 运行时环境变量

后台前台都用这些值：

- `PUBLIC_WEB_URL`
- `ADMIN_WEB_URL`
- `API_URL`

数据库模式则再加：

- `DATABASE_URL`
- `REDIS_URL`

## 生产建议

- 前台和后台都不要直接暴露端口，统一走 Nginx
- `api.pubcms.com` 单独反代，后台通过它请求接口
- 如果你只想“点一下就跑”，可以在宝塔里建一个 PM2 进程模板，名称固定用 `sports-web`、`sports-admin`、`sports-api`
