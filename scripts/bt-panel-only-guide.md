# 宝塔面板纯操作部署方案

目标：

- 不用 SSH
- 不用每个域名都在宝塔建站
- 后续新增域名，只需要 DNS 解析到服务器，再到后台添加站点
- 宝塔只维护 3 个入口：前台、后台、API

## 一、整体结构

固定三个 Node 服务：

| 服务 | 宝塔里的用途 | 本机端口 |
| --- | --- | --- |
| `sports-web` | 所有前台站点 | `3000` |
| `sports-admin` | 后台管理 | `3001` |
| `sports-api` | 后台接口 | `4000` |

固定三个宝塔站点：

| 宝塔站点 | 反代目标 |
| --- | --- |
| `前台默认站点` | `http://127.0.0.1:3000` |
| `admin.pubcms.com` | `http://127.0.0.1:3001` |
| `api.pubcms.com` | `http://127.0.0.1:4000` |

后面新增的前台域名，不要再去宝塔新增站点。

## 二、宝塔安装软件

宝塔后台 -> 软件商店，安装：

- `Nginx`
- `Node.js 版本管理器`
- `PM2 管理器`

Node 版本建议选择：

- `Node.js 20 LTS`

## 三、上传项目

宝塔后台 -> 文件：

1. 进入 `/www/wwwroot`
2. 上传项目压缩包
3. 解压成 `/www/wwwroot/Sports-mian`

## 四、创建三个 Node 项目

宝塔后台 -> Node 项目 -> 添加 Node 项目。

### 1. API 项目

- 项目名称：`sports-api`
- 项目目录：`/www/wwwroot/Sports-mian`
- 启动文件：`/www/wwwroot/Sports-mian/bt-api.js`
- 运行目录：`/www/wwwroot/Sports-mian`
- Node 版本：`20`
- 包管理器：`pnpm`
- 环境变量：

```text
NODE_ENV=production
API_PORT=4000
PUBLIC_WEB_URL=http://www.pubcms.com
ADMIN_WEB_URL=http://admin.pubcms.com
API_URL=http://api.pubcms.com
```

### 2. 前台项目

- 项目名称：`sports-web`
- 项目目录：`/www/wwwroot/Sports-mian`
- 启动文件：`/www/wwwroot/Sports-mian/bt-web.js`
- 运行目录：`/www/wwwroot/Sports-mian`
- Node 版本：`20`
- 包管理器：`pnpm`
- 环境变量：

```text
NODE_ENV=production
PUBLIC_WEB_URL=http://www.pubcms.com
ADMIN_WEB_URL=http://admin.pubcms.com
API_URL=http://api.pubcms.com
```

### 3. 后台项目

- 项目名称：`sports-admin`
- 项目目录：`/www/wwwroot/Sports-mian`
- 启动文件：`/www/wwwroot/Sports-mian/bt-admin.js`
- 运行目录：`/www/wwwroot/Sports-mian`
- Node 版本：`20`
- 包管理器：`pnpm`
- 环境变量：

```text
NODE_ENV=production
PUBLIC_WEB_URL=http://www.pubcms.com
ADMIN_WEB_URL=http://admin.pubcms.com
API_URL=http://api.pubcms.com
```

三个项目都创建好以后，在宝塔 Node 项目页面点：

1. 安装依赖
2. 构建项目
3. 启动

如果宝塔只允许一个项目执行构建，只需要对任意一个项目执行一次构建即可，因为三个项目共用同一个代码目录。

## 五、宝塔反向代理

### 1. API 站点

宝塔后台 -> 网站 -> 添加站点：

- 域名：`api.pubcms.com`
- 根目录：随便选 `/www/wwwroot/Sports-mian`
- PHP：纯静态

站点设置 -> 反向代理：

- 目标 URL：`http://127.0.0.1:4000`

配置文件里确认有：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### 2. 后台站点

宝塔后台 -> 网站 -> 添加站点：

- 域名：`admin.pubcms.com`
- 根目录：随便选 `/www/wwwroot/Sports-mian`
- PHP：纯静态

站点设置 -> 反向代理：

- 目标 URL：`http://127.0.0.1:3001`

同样确认上面的 `proxy_set_header` 都存在。

### 3. 前台默认站点

这是重点。

宝塔后台 -> 网站 -> 添加站点：

- 域名：先填主域名，比如 `www.pubcms.com`
- 根目录：`/www/wwwroot/Sports-mian`
- PHP：纯静态

然后进入：

网站 -> `www.pubcms.com` -> 配置文件

把这个站点配置改成 `infra/bt-default-public.conf` 里的内容。

这个配置的关键是：

```nginx
listen 80 default_server;
server_name _;
proxy_pass http://127.0.0.1:3000;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
```

这表示：任何没有单独匹配到宝塔站点的域名，都会进前台 `3000`。

## 六、后续新增域名怎么做

以后新增前台站点，不需要动宝塔。

只做两步：

1. 域名 DNS 解析到服务器 IP
2. 进入你的后台，添加站点，填写这个域名、模板、TDK、URL 规则

请求流程是：

```text
用户访问新域名
-> Nginx 默认前台入口
-> sports-web 读取 Host
-> 根据后台站点域名匹配对应站点
-> 渲染这个站点自己的模板、TDK、URL 规则
```

所以后续几百个前台域名，都不应该再去宝塔加反代。

## 七、SSL 说明

HTTP 可以直接用默认站点接所有域名。

HTTPS 有证书限制：

- 同一个主域名的子域名，建议申请通配符证书，例如 `*.pubcms.com`
- 不同主域名，例如 `a.com`、`b.com`、`c.com`，浏览器要求每个主域名都有对应证书
- 如果你后续域名特别多，建议统一接 Cloudflare，再由 Cloudflare 处理证书

这是 HTTPS 证书规则，不是项目代码限制。

## 八、检查是否成功

宝塔里看三个 Node 项目都显示运行中：

- `sports-api`
- `sports-web`
- `sports-admin`

浏览器访问：

- `http://api.pubcms.com/health`
- `http://admin.pubcms.com`
- `http://www.pubcms.com`

新增域名测试：

1. DNS 指向服务器
2. 后台添加站点域名
3. 浏览器访问新域名

只要后台配置了这个域名，就应该进入对应站点；没有配置就显示 404。
