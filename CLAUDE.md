# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**MarkLauncher** 是一个 Chrome 浏览器新标签页扩展，替代默认新标签页，提供书签管理和快速访问功能。

**核心特性：**
- 左侧文件夹导航（Chrome 书签栏/其他书签），点击分组后右侧仅显示当前分组，`All` 显示全部
- 双模式搜索（书签搜索 + 网络搜索），Tab键切换模式
- 网络搜索使用浏览器默认搜索引擎（Chrome Search API）
- 响应式紧凑界面，支持深色主题
- 键盘快捷键支持（Ctrl+K 聚焦搜索，ESC 关闭弹窗）
- 右键菜单支持新标签页打开、复制链接、置顶/取消置顶、二维码分享
- 国际化支持（中英文）
- 设置系统（主题切换）
- **智能卡片背景色**：自动从书签图标提取主色调并设置为详情卡片和置顶图标背景

## 技术架构

### 核心技术栈
- **平台**: Chrome Extension Manifest V3
- **语言**: 原生 JavaScript (ES6+)
- **样式**: CSS3 (Grid + Flexbox) + CSS 变量系统
- **API**: Chrome Extension APIs (bookmarks, storage, search, favicon)
- **架构**: 单页面应用，事件驱动模型

### 代码结构
```
扩展核心文件（extension/ 目录）：
├── manifest.json          # Chrome Extension V3 配置文件
├── newtab.html           # 主页面（三栏布局）
├── newtab.js             # MarkLauncher 主类
├── styles.css            # 样式文件
├── background.js         # 后台服务工作者
├── qrcode.min.js         # 二维码生成库
└── _locales/             # 国际化文件
    ├── en/messages.json  # 英文翻译
    └── zh_CN/messages.json  # 中文翻译
```

### 架构模式
- **单类设计**: `MarkLauncher` 类封装所有核心功能，无外部框架依赖
- **模块化方法**: 按功能分离的方法组织（搜索、书签、设置、UI、二维码、国际化）
- **双层数据结构**: `bookmarksBarData` 和 `otherBookmarksData`
- **事件驱动**: DOM 事件和 Chrome API 事件处理
- **国际化系统**: 基于Chrome Extension i18n API
- **主题系统**: CSS变量 + 深色/明亮主题切换
- **智能配色**: 使用 Canvas API 提取图标主色调并应用为卡片背景

## 开发工作流

### 开发环境设置
```bash
# 无需构建工具链，直接开发
# 1. 修改 extension/ 目录中的源码文件
# 2. 在 chrome://extensions/ 重新加载扩展
# 3. 使用浏览器开发者工具调试
```

### 扩展安装（开发模式）
1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/` 目录（不是项目根目录）

### 发布流程
```bash
# 创建并推送版本 tag（自动触发 GitHub Actions 发布）
git tag v1.0.6
git push origin v1.0.6

# Workflow 会自动：
# 1. 打包 extension/ 目录为 marklauncher-v1.0.6.zip
# 2. 创建 GitHub Release
# 3. 上传 zip 文件到 Release
```

### GitHub Actions Workflows
- **release.yml**: 在推送 `v*` tag 时触发，自动打包并发布到 GitHub Releases
- **ci.yml**: 在 push 到 main 或 PR 时触发，测试打包功能

## 重要设计决策

### 1. 无构建工具架构
- **原因**: 保持简洁，减少依赖，易于维护
- **影响**: 直接修改文件，无需编译步骤
- **调试**: 使用浏览器开发者工具

### 2. 原生 JavaScript 实现
- **优势**: 性能优异，无外部依赖，快速加载
- **模式**: ES6+ 类语法，模块化方法组织
- **兼容性**: Chrome 87+ 支持（需要 Chrome Search API）

### 3. Chrome Search API 集成
- **使用场景**: 网络搜索功能
- **API 方法**: `chrome.search.query({ text, disposition })`
- **优势**: 自动使用浏览器默认搜索引擎，无需用户配置
- **权限**: 需要 `search` 权限

### 4. 智能配色系统（newtab.js）
使用 Canvas API 提取书签图标主色调：
- 创建 32x32 Canvas 绘制图标
- 统计像素颜色频率（采样步长4）
- 过滤透明、纯白、纯黑色
- 颜色量化减少数量（16级）
- 应用为 CSS 变量驱动的详情卡片与置顶图标背景色
- 处理 CORS 错误和加载失败
- 在 `bindBookmarkItemEvents()` 中自动触发

### 5. CSS 变量主题系统
```css
:root {
    --primary-color: #007AFF;
    --background-gradient: #F5F5F7;
    --surface-color: rgba(255, 255, 255, 0.85);
}

:root[data-theme='dark'] {
    --primary-color: #0A84FF;
    --background-gradient: #1C1C1E;
    --surface-color: rgba(30, 30, 32, 0.90);
}
```

### 6. 权限最小化
- `bookmarks`: 读取书签数据
- `storage`: 保存用户设置和置顶书签
- `search`: 网络搜索功能（Chrome Search API）
- `favicon`: 获取网站图标

### 7. 扩展目录分离
- 所有扩展文件在 `extension/` 目录
- 便于自动化打包和发布
- 清晰的项目结构

## 核心功能实现

### 书签数据管理
- **Chrome API**: `chrome.bookmarks.getTree()`
- **数据结构**: 分离文件夹和书签
- **状态管理**: `currentPrimaryTab`, `currentFolderId`, `sidebarOpen`

### 搜索功能
- **双模式**: 书签搜索 + 网络搜索
- **搜索引擎**: 使用浏览器默认搜索引擎（Chrome Search API）
- **快捷键**: Ctrl+K 聚焦，Tab 切换模式，ESC 关闭弹窗
- **实时过滤**: 支持标题、URL、文件夹搜索

### 侧边栏功能
- **分组过滤**: 点击左侧分组后，右侧仅渲染当前分组内容
- **All 视图**: 仅在选择 `All` 时显示全部分组
- **移动端抽屉**: 小屏幕下使用抽屉式导航
- **低调配色**: 激活状态使用灰色系（非蓝色高调）

### 二维码功能
- **右键菜单**: 上下文菜单包含新标签页打开、复制链接、置顶/取消置顶、二维码分享
- **本地生成**: qrcode-generator 库
- **简化界面**: 只显示标题、二维码和复制链接按钮
- **ESC 关闭**: 支持键盘快捷键关闭

### 智能卡片背景色
- **自动提取**: 图标加载完成后自动分析颜色
- **Canvas API**: 使用 getImageData 获取像素数据
- **性能优化**: 32x32 小尺寸，采样步长4
- **CORS 处理**: 跨域图标使用默认背景色
- **应用范围**: 详情列表卡片背景、置顶区域图标容器背景
- **混合方式**: JavaScript 设置 `--favicon-color`，CSS 叠加透明渐层

### 主题系统
- **CSS变量**: `:root` 和 `[data-theme="dark"]` 定义
- **主题切换**: JavaScript 动态切换主题
- **主题持久化**: Chrome Storage 保存主题设置
- **配色协调**: iOS/macOS 风格配色（#007AFF 蓝色，#F5F5F7 象牙白）

### 国际化系统
- **Chrome i18n API**: `chrome.i18n.getMessage()`
- **动态语言**: 支持中英文切换
- **翻译文件**: `_locales/` 目录下的 JSON 文件

### 设置存储
- **Chrome Storage**: `chrome.storage.sync`
- **数据同步**: 跨设备设置同步（置顶书签、主题设置）
- **配置项**: 主题设置

### 键盘快捷键
- **Ctrl+K**: 聚焦搜索框
- **Tab**: 切换搜索模式（书签/网络）
- **Enter**: 执行网络搜索
- **Escape**:
  - 关闭设置弹窗
  - 关闭二维码弹窗
  - 清除搜索（当没有弹窗打开时）

## 关键文件说明

### manifest.json
- Chrome Extension V3 配置
- 定义权限和入口点
- 设置新标签页覆盖
- 当前版本: 1.0.6

### newtab.js (MarkLauncher 类)
**重要方法**：
- `init()`: 初始化，加载书签和设置
- `loadBookmarks()`: 加载书签数据
- `renderBookmarkItem()`: 渲染单个书签
- `bindBookmarkItemEvents()`: 绑定书签事件并触发配色提取
- `applyFaviconColorToCard()`: 应用图标颜色到卡片背景
- `extractAndApplyColor()`: 提取主色调并应用（包含颜色统计算法）
- `searchBookmarks()`: 搜索功能
- `performWebSearch()`: 网络搜索（使用 Chrome Search API）
- `loadSettings()` / `saveSettings()`: 设置管理
- `showQRCodeModal()` / `generateQRCode()`: 二维码功能
- `applyTheme()` / `toggleTheme()`: 主题功能
- `bindEvents()`: 绑定全局事件监听器（包括 ESC 键处理）

### styles.css
**配色变量**（浅色主题）：
- `--primary-color: #007AFF` (iOS 蓝)
- `--background-gradient: #F5F5F7` (象牙白)
- `--surface-color: rgba(255, 255, 255, 0.85)`
- `--text-primary: #1D1D1F`
- `--shadow-sm/md/lg`: 柔和阴影

**配色变量**（深色主题）：
- `--primary-color: #0A84FF`
- `--background-gradient: #1C1C1E`
- `--surface-color: rgba(30, 30, 32, 0.90)`
- `--text-primary: #F5F5F7`

**特殊样式**：
- `.bookmark-item`: 卡片背景色使用 `--favicon-color` 变量混合生成
- `.empty-state`: 空状态使用透明背景，不再显示提示卡片底色
- 左侧导航激活状态使用低调灰色，非蓝色
- 设置面板添加 `overflow-x: hidden` 防止水平滚动条

## 常见开发任务

### 添加新功能
1. 在 `MarkLauncher` 类中添加新方法
2. 在 `newtab.html` 中添加相应 UI 元素
3. 在 `styles.css` 中添加样式
4. 绑定事件处理器（通常在 `bindEvents()` 方法中）

### 修改样式
- 使用 CSS 变量保持一致性
- 响应式设计考虑移动端适配
- 遵循 iOS/macOS 风格视觉规范
- 注意深色/浅色主题同时调整
- 确保容器不会出现水平滚动条（添加 `overflow-x: hidden`）

### 调试技巧
- 使用 Chrome DevTools 断点调试
- 检查 Chrome API 权限
- 查看 Console 错误信息
- 使用扩展管理页面重新加载
- 图标颜色提取失败会显示 console.warn

### 发布新版本
1. 修改 `manifest.json` 中的版本号
2. 提交代码: `git commit -m "version x.x.x"`
3. 创建 tag: `git tag vx.x.x`
4. 推送 tag: `git push origin vx.x.x`
5. GitHub Actions 自动创建 Release 并上传 zip

## 浏览器兼容性
- Chrome 87+ ✅（需要 Chrome Search API）
- Edge 87+ (Chromium) ✅
- 不支持 Firefox/Safari（不同扩展 API）

## 版本历史
- **v1.0.6**:
  - 调整整体界面为更紧凑的卡片与侧边导航样式
  - 左侧导航点击分组后，右侧仅显示当前分组，`All` 显示全部
  - 书签卡片内 hover 操作移除，统一迁移到右键菜单
  - 置顶区域改为无标题快捷区，并增强图标取色背景表现
  - 搜索框改为透明背景 + 边框样式
  - 搜索无结果和无书签提示取消背景卡片
- **v1.0.5**:
  - 使用 Chrome Search API 实现网络搜索（移除搜索引擎配置）
  - 移除同步状态显示
  - 添加 ESC 键关闭弹窗功能
  - 简化二维码弹窗界面
  - 修复设置面板滚动条问题
