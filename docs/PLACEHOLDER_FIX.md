# 搜索栏提示词动态更新修复

## 问题描述

在设置中更改搜索引擎后，搜索栏的提示词没有相应更新，仍然显示固定的"Google搜索..."，无法反映用户选择的搜索引擎。

## 修复内容

### 1. 新增方法：`updateSearchPlaceholder()`

```javascript
updateSearchPlaceholder() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const searchEngineNames = {
        google: 'Google',
        bing: 'Bing',
        baidu: '百度'
    };

    const currentEngine = searchEngineNames[this.settings.searchEngine] || 'Google';

    // 根据当前搜索模式更新提示词
    if (this.searchMode === 'bookmark') {
        searchInput.placeholder = '搜索书签...';
    } else {
        searchInput.placeholder = `在 ${currentEngine} 中搜索...`;
    }
}
```

### 2. 修复触发点

#### 搜索引擎设置变更时
```javascript
// 在 bindSettingsEvents() 中
radio.onchange = (e) => {
    if (e.target.checked) {
        this.settings.searchEngine = e.target.value;
        this.saveSettings();
        this.updateSearchPlaceholder(); // 新增
    }
};
```

#### 搜索模式切换时
```javascript
// 在 switchSearchMode() 中
// 替换硬编码的提示词
this.updateSearchPlaceholder();
```

#### 应用初始化时
```javascript
// 在 init() 中
this.render();
this.updateSearchPlaceholder(); // 新增
```

## 功能效果

### 修复前
- 搜索模式固定显示"搜索书签..."或"Google搜索..."
- 更改搜索引擎设置后，提示词不会更新

### 修复后
- **书签模式**：始终显示"搜索书签..."
- **Google模式**：显示"在 Google 中搜索..."
- **Bing模式**：显示"在 Bing 中搜索..."
- **百度模式**：显示"在 百度 中搜索..."

### 用户体验
1. 在设置中选择搜索引擎后，立即生效
2. 切换搜索模式时，提示词相应更新
3. 页面加载时显示正确的提示词
4. 保持语言一致性（中英文混合优化）

## 测试验证

创建了测试页面 `placeholder-test.html` 来验证功能：
- 手动测试各种组合
- 自动化测试覆盖所有场景
- 实时预览提示词变化

## 技术细节

- 使用配置化的搜索引擎名称映射
- 保持向后兼容性
- 错误处理和空值检查
- 与现有代码风格保持一致

## 相关文件

- `newtab.js` - 核心修复逻辑
- `placeholder-test.html` - 功能测试页面
- `PLACEHOLDER_FIX.md` - 本说明文档