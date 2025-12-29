// 后台服务工作者
chrome.runtime.onInstalled.addListener(() => {
  try {
    console.log('MarkLauncher已安装');
  } catch (error) {
    console.error('安装事件处理失败:', error);
  }
});

// 扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  try {
    // 可以在这里添加设置页面或其他功能
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({
        url: 'chrome://bookmarks'
      });
    }
  } catch (error) {
    console.error('扩展图标点击事件处理失败:', error);
  }
});

// 错误处理
chrome.runtime.onError?.addListener((error) => {
  console.error('Chrome扩展错误:', error);
});