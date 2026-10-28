# 部署兼容性回归

`deployment.js` 使用 Playwright CLI 的 `run-code --filename` 运行，覆盖真正处于非安全上下文的 HTTP IP 页面，并通过请求路由接入本机测试服务。另覆盖缺少 `AbortSignal.timeout` / `structuredClone` 的场景，以及模拟 HTTPS IP 页面。它不连接真实 FRP，也不验证公网 TLS 证书。

测试包括登录、ID 创建、真实文件选择器、取消导入、TXT/HTML 导入、自动保存和重新加载、菜单互斥、版本完整性。测试会在 4175 端口服务中创建 `deployment_admin` 测试账号，请务必使用独立数据目录，不能连接实际用户数据库。

运行方法（需要 Python、Node.js 和 Playwright CLI 可用的 Chrome 浏览器）：

```sh
mkdir -p output/playwright output/deployment-test-storage
NOTES_DATA_DIR="$PWD/output/deployment-test-storage" NOTES_PORT=4175 sh start.sh
```

保持该终端运行，在另一个终端执行：

```sh
npx --yes --package @playwright/cli playwright-cli -s=deploy-check open http://127.0.0.1:4175/login.html
npx --yes --package @playwright/cli playwright-cli -s=deploy-check run-code --filename tests/browser/deployment.js
```

脚本会初始化隔离的测试账号，并返回每种访问环境的检查结果。截图写入 `output/playwright/`。测试结束后停止这次启动的测试服务。

## 经文分组与波浪线快捷键

`reading-tools.js` 在 4173 端口服务上使用独立浏览器上下文，不读取或更改当前浏览器文档。检查新建文档默认信息、预览信息、自定义信息刷新保留、旧约／新约卷章筛选、跨约多选与搜索跳转、关闭清空、Ctrl+U 切换红色粗实线下划线、Ctrl+Shift+U 切换红色粗波浪线、Ctrl+Shift+H 切换黄色高亮及帮助、移动端控件宽度。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check open http://127.0.0.1:4173/index.html
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/reading-tools.js
```

这个脚本需要该地址处于未登录访客状态，不会初始化管理员或修改服务器文档。截图写入 `output/playwright/`。

`formatting.js` 使用同样的独立访客上下文，验证实线和波浪线重叠后从各自菜单只清除对应线型、对应快捷键独立取消、两种嵌套顺序、实际快捷键叠加、只清除选区、混合标注、连续清除、跨段清除、保留文字其他格式、旧式下划线和自选颜色波浪线快捷键切换、粗体／斜体／删除线切换、撤销重做与刷新保留。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/formatting.js
```

`lists.js` 在 4173 端口验证光标所在整段转换为各类列表、光标和内联格式保留、自定义起始编号、行首输入编号加空格创建列表、Tab／Shift+Tab 调整嵌套、Shift+Enter 插入不编号的说明、空列表项退出、撤销重做、保存刷新、讲义预览及手机工具栏。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/lists.js
```

`templates.js` 也会验证新建和管理模板窗口按模板名称、正文搜索，以及没有匹配结果时的操作禁用状态。账号、同步、备份与冲突检查需使用隔离的 4175 测试数据目录。

## 个人文档模板

`templates.js` 使用独立浏览器上下文，在 4173 检查模板保存、默认与空白选择、完整格式复制、原文档与模板独立、重命名、更新、删除、刷新保留、文件库入口及手机布局。登录、账号隔离、多设备同步、备份导入导出、冲突合并在独立的 4175 测试服务上验证。必须按本页第一节启动隔离数据目录，不能将 4175 指向真实用户数据库。

```sh
npx --yes --package @playwright/cli playwright-cli -s=templates-check open http://127.0.0.1:4173/index.html
npx --yes --package @playwright/cli playwright-cli -s=templates-check run-code --filename tests/browser/templates.js
```

脚本会在隔离服务中创建测试账号；测试管理员使用本页第一节的 `deployment_admin`。截图写入 `output/playwright/`。
