# MarkLauncher - 书签启动器

一个简洁高效的 Chrome 新标签页扩展，替代默认新标签页，提供书签管理和快速访问功能。

## 功能特点

- 🗂️ **文件夹导航** - 左侧 Chrome 书签栏/其他书签分类导航，支持折叠/展开
- 🔍 **双模式搜索** - 书签搜索 + 网络搜索，使用浏览器默认搜索引擎
- 🎨 **智能卡片配色** - 自动从书签图标提取主色调，5% 透明度微妙视觉效果
- 📱 **响应式设计** - 适配不同屏幕尺寸的 Material Design 界面
- ⚡ **快速启动** - 点击书签直接打开，Ctrl+点击新标签页打开
- 🌙 **深色主题** - 支持明暗主题切换（跟随系统/浅色/深色）
- ⌨️ **键盘快捷键** - Ctrl+K 快速聚焦搜索，Tab 切换搜索模式，ESC 关闭弹窗
- 📊 **二维码生成** - 右键为书签生成二维码，简化界面设计
- 🌍 **国际化** - 支持中英文界面
- 📌 **置顶功能** - 置顶常用书签，支持跨设备同步

## 安装方法

### 开发者模式安装

1. 下载本项目到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 **`extension/`** 目录（不是项目根目录）
6. 安装完成后，打开新标签页即可使用

## 项目结构

```
marklauncher/
├── extension/              # 扩展核心文件目录
│   ├── manifest.json       # Chrome Extension V3 配置文件
│   ├── newtab.html         # 主页面（三栏布局结构）
│   ├── newtab.js           # MarkLauncher 主类（核心功能实现）
│   ├── styles.css          # 样式文件（响应式设计 + CSS变量）
│   ├── background.js       # 后台服务工作者
│   ├── qrcode.min.js       # 二维码生成库
│   ├── icons/              # 图标文件
│   │   ├── icon16.png      # 16x16 图标
│   │   ├── icon48.png      # 48x48 图标
│   │   └── icon128.png     # 128x128 图标
│   └── _locales/           # 国际化文件
│       ├── en/             # 英文翻译
│       │   └── messages.json
│       └── zh_CN/          # 中文翻译
│           └── messages.json
├── .github/                # GitHub Actions 配置
│   └── workflows/
│       ├── release.yml     # 自动发布流程
│       └── ci.yml          # CI 测试流程
├── CLAUDE.md               # Claude Code 指导文档
└── README.md               # 项目说明文档
```

## 主要文件说明

### manifest.json
- 定义扩展的基本信息和权限
- 设置新标签页替换
- 配置所需的 Chrome API 权限（bookmarks, storage, search, favicon）

### newtab.html
- 新标签页的 HTML 结构
- 包含搜索栏、文件夹导航和书签显示区域
- 简洁的二维码弹窗和设置面板

### newtab.js
- 核心功能实现（`MarkLauncher` 类）
- 书签数据获取和处理
- 搜索和导航逻辑
- 用户交互处理
- Chrome Search API 集成

### styles.css
- 现代化 UI 样式
- 响应式布局设计
- CSS 变量主题系统
- 动画和过渡效果

## 使用说明

### 基本操作

1. **文件夹导航** - 点击左侧书签栏/其他书签切换分类，点击箭头折叠/展开侧边栏
2. **书签打开** - 点击书签卡片在当前标签页打开
3. **新标签页打开** - Ctrl+点击书签在新标签页打开
4. **双模式搜索** - 在顶部搜索框输入关键词进行书签搜索，Tab 键切换到网络搜索
5. **二维码生成** - 右键点击书签选择生成二维码
6. **主题切换** - 在设置中切换明暗主题
7. **置顶书签** - 右键点击书签选择置顶，常用书签快速访问

### 键盘快捷键

- `Ctrl + K` - 聚焦到搜索框
- `Tab` - 在书签搜索和网络搜索模式间切换（搜索框聚焦时）
- `Enter` - 执行网络搜索（网络搜索模式下）
- `Escape` - 关闭弹窗（设置/二维码）或清除搜索

## 权限说明

本扩展需要以下权限：

- `bookmarks` - 读取和管理书签
- `storage` - 本地数据存储和跨设备同步（置顶书签、主题设置）
- `search` - 网络搜索功能（Chrome Search API）
- `favicon` - 获取网站图标

## 技术架构

- **平台**: Chrome Extension Manifest V3
- **语言**: 原生 JavaScript (ES6+)，单类设计模式
- **样式**: CSS3 (Grid + Flexbox) + CSS 变量主题系统
- **架构**: 单页面应用，事件驱动模型
- **国际化**: Chrome Extension i18n API
- **数据存储**: Chrome Storage API（跨设备同步）
- **搜索功能**: Chrome Search API（使用浏览器默认搜索引擎）

## 浏览器兼容性

- Chrome 87+ ✅（需要 Chrome Search API）
- Edge 87+ (Chromium) ✅
- 不支持 Firefox/Safari（不同扩展 API）

## 开发特点

- **无构建工具**: 直接修改源码，无需编译步骤
- **原生开发**: 使用浏览器开发者工具调试
- **模块化设计**: 按功能分离的方法组织
- **权限最小化**: 仅申请必要的 Chrome API 权限

## 发布流程

```bash
# 创建版本标签
git tag v1.0.5
git push origin v1.0.5

# GitHub Actions 自动：
# 1. 打包 extension/ 目录为 marklauncher-v1.0.5.zip
# 2. 创建 GitHub Release
# 3. 上传 zip 文件到 Release
```

## 版本历史

### v1.0.5 (2025-02-10)
- ✨ 使用 Chrome Search API 实现网络搜索（自动使用浏览器默认搜索引擎）
- ❌ 移除搜索引擎选择功能
- ❌ 移除同步状态显示
- ✨ 添加 ESC 键关闭弹窗功能
- 🎨 简化二维码弹窗界面
- 🐛 修复设置面板水平滚动条问题

### v1.0.4
- 初始版本
- 基础书签管理和导航功能
- 双模式搜索（书签 + 网络）
- 二维码生成功能
- 主题切换（明暗主题）
- 国际化支持（中英文）

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证

MIT License
