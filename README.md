# MarkLauncher - 书签启动器

一个简洁高效的Chrome新标签页扩展，帮助您快速访问和管理书签。

## 功能特点

- 🗂️ **左侧文件夹导航** - 一级文件夹分类显示，快速切换
- 🔍 **实时搜索** - 支持按标题、URL和文件夹搜索书签
- 📱 **响应式设计** - 适配不同屏幕尺寸
- ⚡ **快速启动** - 点击书签直接打开，Ctrl+点击新标签页打开
- 🎨 **现代化界面** - 简洁美观的Material Design风格
- ⌨️ **键盘快捷键** - Ctrl+K 快速聚焦搜索框

## 安装方法

### 开发者模式安装

1. 下载本项目到本地
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 安装完成后，打开新标签页即可使用

## 项目结构

```
marklauncher/
├── manifest.json          # 扩展配置文件
├── newtab.html           # 新标签页HTML结构
├── newtab.js             # 主要JavaScript逻辑
├── styles.css            # 样式文件
├── background.js         # 后台服务工作者
├── icons/                # 图标文件
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── docs/                 # 文档文件夹
│   ├── FEATURES.md       # 功能特点说明
│   ├── INSTALL.md        # 安装指南
│   ├── PLACEHOLDER_FIX.md # 占位符修复说明
│   ├── SEARCH_BUTTONS_UPDATE.md # 搜索按钮更新说明
│   └── SETTINGS.md       # 设置功能说明
├── tests/                # 测试文件夹
│   ├── qrcode-test.html  # 二维码功能测试
│   ├── pinned-test.html  # 置顶功能测试
│   ├── search-buttons-test.html  # 搜索按钮测试
│   ├── settings-test.html  # 设置功能测试
│   ├── layout-test.html  # 布局测试
│   ├── placeholder-test.html  # 占位符测试
│   ├── qrcode-simple-test.html  # 简单二维码测试
│   └── test.html         # 通用测试文件
├── CLAUDE.md             # Claude Code 指导文档
└── README.md             # 项目说明文档
```

## 主要文件说明

### manifest.json
- 定义扩展的基本信息和权限
- 设置新标签页替换
- 配置所需的Chrome API权限

### newtab.html
- 新标签页的HTML结构
- 包含搜索栏、文件夹导航和书签显示区域

### newtab.js
- 核心功能实现
- 书签数据获取和处理
- 搜索和导航逻辑
- 用户交互处理

### styles.css
- 现代化UI样式
- 响应式布局设计
- 动画和过渡效果

## 使用说明

### 基本操作

1. **文件夹切换** - 点击左侧文件夹查看对应书签
2. **书签打开** - 点击书签卡片在当前标签页打开
3. **新标签页打开** - Ctrl+点击书签在新标签页打开
4. **搜索书签** - 在顶部搜索框输入关键词
5. **清除搜索** - 点击搜索框右侧的×按钮

### 键盘快捷键

- `Ctrl + K` - 聚焦到搜索框
- `Escape` - 清除搜索或退出搜索框焦点

## 权限说明

本扩展需要以下权限：

- `bookmarks` - 读取和管理书签
- `storage` - 本地数据存储
- `tabs` - 创建和管理标签页

## 技术特点

- 使用现代JavaScript (ES6+) 开发
- 采用CSS Grid和Flexbox布局
- 遵循Material Design设计规范
- 支持Chrome Extension Manifest V3

## 浏览器兼容性

- Chrome 88+
- Edge 88+ (基于Chromium)

## 开发计划

- [ ] 深色模式支持
- [ ] 书签编辑功能
- [ ] 自定义主题颜色
- [ ] 书签导入/导出
- [ ] 使用统计显示

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License