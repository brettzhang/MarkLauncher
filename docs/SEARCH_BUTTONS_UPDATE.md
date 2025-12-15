# 搜索模式切换按钮优化

## 更新内容

### 1. 简化按钮设计

**修改前：**
```html
<button class="mode-btn">
    <svg>...</svg>
    书签
</button>
<button class="mode-btn">
    <svg>...</svg>
    Google
</button>
```

**修改后：**
```html
<button class="mode-btn">书签</button>
<button class="mode-btn" id="webSearchBtn">Google</button>
```

### 2. 动态按钮文本

网络搜索按钮现在会根据设置的搜索引擎动态显示：
- **Google模式**：显示 "Google"
- **Bing模式**：显示 "Bing"
- **百度模式**：显示 "百度"

### 3. 同步更新机制

#### 设置更改时
```javascript
// 搜索引擎选择
radio.onchange = (e) => {
    if (e.target.checked) {
        this.settings.searchEngine = e.target.value;
        this.saveSettings();
        this.updateSearchPlaceholder();      // 更新搜索栏提示词
        this.updateSearchModeButtons();      // 更新按钮文本
    }
};
```

#### 新增方法
```javascript
updateSearchModeButtons() {
    const webSearchBtn = document.getElementById('webSearchBtn');
    if (!webSearchBtn) return;

    const searchEngineNames = {
        google: 'Google',
        bing: 'Bing',
        baidu: '百度'
    };

    const currentEngine = searchEngineNames[this.settings.searchEngine] || 'Google';
    webSearchBtn.textContent = currentEngine;
}
```

## 技术改进

### 1. 代码重构
- 将 'google' 模式重命名为 'web' 模式，更符合语义
- 统一搜索引擎名称映射，避免硬编码
- 提取公共方法，提高代码复用性

### 2. 用户体验优化
- **即时反馈**：设置更改后按钮文本立即更新
- **直观显示**：用户可以直观看到当前选择的搜索引擎
- **简洁设计**：移除图标，界面更加简洁

### 3. 一致性保证
- 搜索栏提示词和按钮文本保持同步
- 初始化时正确显示当前设置
- 所有触发点都调用相应的更新方法

## 功能演示

### 场景1：默认状态
- 书签按钮：`书签`
- 网络搜索按钮：`Google`
- 搜索栏提示词：`搜索书签...`

### 场景2：切换到Bing并启用网络搜索
1. 在设置中选择Bing引擎
2. 网络搜索按钮自动变为：`Bing`
3. 切换到网络搜索模式
4. 搜索栏提示词变为：`在 Bing 中搜索...`

### 场景3：切换到百度
1. 在设置中选择百度引擎
2. 网络搜索按钮自动变为：`百度`
3. 搜索栏提示词相应更新

## 相关文件

- `newtab.html` - 更新搜索模式切换按钮HTML结构
- `newtab.js` - 重构搜索模式逻辑，添加动态更新方法
- `search-buttons-test.html` - 功能测试页面
- `SEARCH_BUTTONS_UPDATE.md` - 本说明文档

## 测试验证

创建了专门的测试页面验证：
- 按钮文本动态更新
- 搜索模式切换
- 引擎选择同步
- 完整的自动化测试覆盖

## 后续优化建议

1. **动画效果**：可以为按钮文本变化添加淡入淡出动画
2. **键盘快捷键**：可以考虑添加快捷键快速切换搜索引擎
3. **更多引擎**：框架支持添加更多搜索引擎选项
4. **个性化设置**：允许用户自定义按钮文本