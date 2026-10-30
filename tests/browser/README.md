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

`lists.js` 在 4173 端口验证光标所在整段转换为各类列表、光标和内联格式保留、自定义起始编号、行首输入编号加空格创建列表、Tab／Shift+Tab 调整嵌套、Shift+Enter 插入不编号的说明、空列表项退出、撤销重做、保存刷新、讲义预览及手机工具栏。另用 Chromium 的组合输入协议验证空列表中输入中文，以及从子列表退出后输入 `2.` 加空格恢复一级列表；覆盖直接文本、DIV、P、BR 四种换行结构，检查文字和光标都在正确的列表项中。

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

## 单项转段落与格式刷

`paragraphs.js` 在独立访客上下文验证第七项转普通段落的菜单、文本类型、快捷键及列表按钮入口，保留文字位置、高亮粗体、后续编号和选区；检查首尾项、撤销重做、保存刷新，以及旧版 P／DIV／直接文字／BR 结构在讲义与表格预览中的实际两字符缩进和手机宽度。

`format-painter.js` 验证单次与连续模式、Esc 和按钮取消、跨正文与分析、局部替换旧格式、两种下划线叠加、未选中区域保留、撤销重做、键盘复制与应用、保存刷新、真实鼠标反向拖选、点击词语、跨段与嵌套列表编号保留，以及手机布局。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/paragraphs.js
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/format-painter.js
```

两份脚本都使用 4173 本机服务和独立浏览器上下文，截图写入 `output/playwright/`。

`paragraph-indent.js` 验证按段取消／恢复首行缩进，对 P、DIV、BR 和直接文字的旧内容都有效；检查其余段落、列表与高亮不变、实际预览缩进距离、讲义／表格布局、选区、撤销重做、刷新保存、格式刷兼容和手机宽度。运行：

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/paragraph-indent.js
```

`paragraph-indent-wrap.js` 检查正文中的手动换行在编辑器和预览中拆分为相同段落、桌面正文宽度产生相同的自动换行位置，并验证桌面与手机上的首行缩进。运行：

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/paragraph-indent-wrap.js
```

`paragraph-indent-batch.js` 验证同一编辑框内连续选择多个段落统一取消／恢复缩进，覆盖混合状态、局部与反向选择、刚好结束在下一段开头、P／DIV／直接文字与 BR／跨行内联标注、选中空段、自动跳过列表和标题、全选、撤销重做、保存刷新及两种预览布局。运行：

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/paragraph-indent-batch.js
```

## 新增段落位置

`paragraph-add.js` 使用独立访客上下文，验证底部“添加下一段”连续点击和顶部新增都在末尾追加，保留已有原文、分析及格式，聚焦新段落，并检查段间插入和刷新保存。需要服务已完成管理员初始化，测试本身不修改服务器文档。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/paragraph-add.js
```

## 栏目缩进与纯净全屏阅读

`column-indent.js` 在独立访客上下文验证文前、文后栏目和对应分析的手动首行缩进，覆盖 P／DIV／直接文字／BR、实际首字位置、两种预览、撤销重做、开关、刷新保存和桌面／手机。

`clean-preview.js` 验证纯净全屏阅读的原生全屏、不支持和拒绝全屏三种情况，覆盖桌面／手机、两种版式、长文滚动、退出图标、Esc、浏览器退出全屏、焦点恢复、字号与文档内容保留。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/column-indent.js
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/clean-preview.js
```

## 统一退出列表与图片分页

`list-exit.js` 验证列表菜单只保留一个退级／取消入口，与 Shift+Tab 一致：有序、无序、任务列表一级取消，二三级逐级退回，光标在文字中间仍整项处理。检查光标继续输入、格式、后续编号、撤销重做、文本类型显示、嵌套列表直接转普通文本真正退出所有 LI 祖先、刷新和手机菜单。

`image-pages.js` 使用楷体长文、两栏不同字号、高亮和波浪线，在讲义与表格版中检查 A4 比例分页、正文源区间连续、分页不切文字行、各页页头像素完全相同、续页栏名、真实多文件下载及顺序、手机和短文。截图样本为 `output/playwright/paged-handout-1.png`、`paged-handout-2.png` 及对应表格版。

```sh
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/list-exit.js
npx --yes --package @playwright/cli playwright-cli -s=reading-check run-code --filename tests/browser/image-pages.js
```
