# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**MarkLauncher** 是一个 Chrome 浏览器新标签页扩展，替代默认新标签页，提供书签管理和快速访问功能。

**核心特性：**
- 左侧文件夹导航（Chrome 书签栏/其他书签），支持折叠/展开
- 双模式搜索（书签搜索 + 网络搜索），Tab键切换模式
- 响应式 Material Design 界面，支持深色主题
- 键盘快捷键支持（Ctrl+K 聚焦搜索）
- 二维码生成功能
- 国际化支持（中英文）
- 完整的设置系统（搜索引擎选择、主题切换）

## 技术架构

### 核心技术栈
- **平台**: Chrome Extension Manifest V3
- **语言**: 原生 JavaScript (ES6+)
- **样式**: CSS3 (Grid + Flexbox) + CSS 变量系统
- **API**: Chrome Extension APIs (bookmarks, storage, tabs)
- **架构**: 单页面应用，事件驱动模型

### 代码结构
```
核心文件：
├── manifest.json          # Chrome Extension V3 配置文件
├── newtab.html           # 主页面（三栏布局）
├── newtab.js             # MarkLauncher 主类（74KB）
├── styles.css            # 样式文件（38KB）
├── background.js         # 后台服务工作者
├── qrcode.min.js         # 二维码生成库（21KB）
└── _locales/             # 国际化文件
    ├── en/messages.json  # 英文翻译
    └── zh_CN/messages.json  # 中文翻译
```

### 架构模式
- **单类设计**: `MarkLauncher` 类封装所有核心功能
- **模块化方法**: 按功能分离的方法组织（搜索、书签、设置、UI、二维码、国际化）
- **双层数据结构**: `bookmarksBarData` 和 `otherBookmarksData`
- **事件驱动**: DOM 事件和 Chrome API 事件处理
- **国际化系统**: 基于Chrome Extension i18n API
- **主题系统**: CSS变量 + 深色/明亮主题切换

## 开发工作流

### 开发环境设置
```bash
# 无需构建工具链，直接开发
# 1. 修改源码文件
# 2. 在 chrome://extensions/ 重新加载扩展
# 3. 使用浏览器开发者工具调试
```


### 扩展安装（开发模式）
1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录

## 重要设计决策

### 1. 无构建工具架构
- **原因**: 保持简洁，减少依赖
- **影响**: 直接修改文件，无需编译步骤
- **调试**: 使用浏览器开发者工具

### 2. 原生 JavaScript 实现
- **优势**: 性能优异，无外部依赖
- **模式**: ES6+ 类语法，模块化方法组织
- **兼容性**: Chrome 88+ 支持

### 3. CSS 变量主题系统
```css
:root {
    --primary-color: #4A90E2;
    --sidebar-width: 280px;
    --header-height: 80px;
}
```

### 4. 权限最小化
- `bookmarks`: 读取书签数据
- `storage`: 保存用户设置
- `tabs`: 创建新标签页

## 核心功能实现

### 书签数据管理
- **Chrome API**: `chrome.bookmarks.getTree()`
- **数据结构**: 分离文件夹和书签
- **状态管理**: `currentPrimaryTab`, `currentFolderId`, `sidebarOpen`

### 搜索功能
- **双模式**: 书签搜索 + 网络搜索
- **搜索引擎**: 支持 Google/Bing/百度（可配置）
- **快捷键**: Ctrl+K 聚焦，Tab 切换模式
- **实时过滤**: 支持标题、URL、文件夹搜索

### 侧边栏功能
- **折叠/展开**: 支持左侧导航栏状态切换
- **状态持久化**: localStorage 存储侧边栏状态
- **平滑动画**: CSS transition 效果

### 二维码功能
- **右键菜单**: 上下文菜单生成二维码
- **本地生成**: qrcode-generator 库
- **备用方案**: HTML Canvas 生成
- **下载功能**: 支持二维码图片下载

### 主题系统
- **CSS变量**: `:root` 和 `[data-theme="dark"]` 定义
- **主题切换**: JavaScript 动态切换主题
- **主题持久化**: Chrome Storage 保存主题设置

### 国际化系统
- **Chrome i18n API**: `chrome.i18n.getMessage()`
- **动态语言**: 支持中英文切换
- **翻译文件**: `_locales/` 目录下的 JSON 文件

### 设置存储
- **Chrome Storage**: `chrome.storage.sync`
- **数据同步**: 跨设备设置同步
- **配置项**: 搜索引擎选择、主题设置、语言设置

## 关键文件说明

### manifest.json
- Chrome Extension V3 配置
- 定义权限和入口点
- 设置新标签页覆盖

### newtab.js (MarkLauncher 类)
- **构造函数**: 初始化数据结构和设置
- **核心方法**:
  - `loadBookmarks()` - 加载书签数据
  - `renderBookmarks()` - 渲染书签列表
  - `searchBookmarks()` - 搜索功能
  - `performWebSearch()` - 网络搜索
  - `loadSettings()` / `saveSettings()` - 设置管理
  - `toggleSidebar()` - 侧边栏切换
  - `showQRCodeModal()` / `generateQRCode()` - 二维码功能
  - `applyTheme()` / `toggleTheme()` - 主题功能
  - `initializeI18n()` - 国际化初始化

### styles.css
- **响应式设计**: CSS Grid + Flexbox
- **主题系统**: CSS 变量 + 深色主题
- **动画**: 平滑过渡效果
- **组件化**: 按功能模块组织样式
- **响应式断点**: 桌面/平板/移动端适配

### _locales/
- **国际化文件**: JSON 格式的翻译文件
- **支持语言**: 中文（zh_CN）、英文（en）
- **消息键**: 功能文本的翻译映射

## 常见开发任务

### 添加新功能
1. 在 `MarkLauncher` 类中添加新方法
2. 在 `newtab.html` 中添加相应 UI 元素
3. 在 `styles.css` 中添加样式
4. 绑定事件处理器（通常在 `bindEvents()` 方法中）

### 修改样式
- 使用 CSS 变量保持一致性
- 响应式设计考虑移动端适配
- 遵循 Material Design 视觉规范

### 调试技巧
- 使用 Chrome DevTools 断点调试
- 检查 Chrome API 权限
- 查看 Console 错误信息
- 使用扩展管理页面重新加载

## 浏览器兼容性
- Chrome 88+ ✅
- Edge 88+ (Chromium) ✅
- 不支持 Firefox/Safari（不同扩展 API）

## 项目文件说明
- `README.md`: 基本项目介绍和使用说明
- `CLAUDE.md`: Claude Code 开发指导文档