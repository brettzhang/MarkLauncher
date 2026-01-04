// 默认使用书签搜索模式
const isGoogleSearch = false;

// 全局国际化函数，支持占位符
function t(key, substitutions) {
    if (!key || !chrome?.i18n?.getMessage) {
        return key;
    }

    try {
        if (substitutions === undefined || substitutions === null) {
            return chrome.i18n.getMessage(key) || key;
        }

        const normalizedSubs = Array.isArray(substitutions)
            ? substitutions
            : String(substitutions);

        return chrome.i18n.getMessage(key, normalizedSubs) || key;
    } catch (error) {
        console.error('i18n 获取失败:', key, error);
        return key;
    }
}

class MarkLauncher {
    constructor() {
        this.bookmarksBarData = { folders: [], bookmarks: [] };
        this.otherBookmarksData = { folders: [], bookmarks: [] };
        this.currentPrimaryTab = 'bookmarks_bar'; // 'bookmarks_bar' or 'other_bookmarks'
        this.currentFolderId = null;
        this.searchTerm = '';
        this.searchMode = 'bookmark'; // 'bookmark' or 'web'

        // 设置相关
        this.settings = {
            searchEngine: 'google', // 'google', 'bing', 'baidu'
            theme: 'system'
        };

        // 置顶功能相关
        this.pinnedBookmarks = []; // 存储置顶书签的URL列表
        this.contextMenuTarget = null; // 右键菜单的目标书签项
        this.scrollAnimationFrame = null; // 记录当前滚动动画帧编号

        // 搜索引擎URL映射
        this.searchEngineUrls = {
            google: 'https://www.google.com/search?q=',
            bing: 'https://www.bing.com/search?q=',
            baidu: 'https://www.baidu.com/s?wd='
        };

        this.themeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

        // 检查Chrome API是否可用
        if (!this.checkChromeAPI()) {
            // 延迟错误显示，确保DOM已加载
            setTimeout(() => {
                this.showError(chrome.i18n.getMessage('chrome_api_error'));
            }, 100);
            return;
        }

        this.init();
    }

    checkChromeAPI() {
        try {
            return typeof chrome !== 'undefined' &&
                   chrome.bookmarks &&
                   chrome.runtime;
        } catch (error) {
            console.error('Chrome API检查失败:', error);
            return false;
        }
    }

    // 初始化国际化文本
    initI18n() {
        try {
            this.updateI18nElements();
            this.updateMainUIText();
            this.updateVersionInfo();
        } catch (error) {
            console.error('初始化国际化失败:', error);
        }
    }

    async init() {
        try {
            // 初始化国际化文本
            this.initI18n();
            // 更新按钮提示
            this.updateButtonTitles();

            // 初始化时隐藏空状态
            document.getElementById('emptyState').classList.add('hidden');

            this.showLoading(true);
            await this.loadSettings(); // 加载设置
            this.initTheme();
            await this.loadPinnedBookmarks(); // 加载置顶书签
            await this.loadBookmarks();
            this.bindEvents();
            this.render();

            // 更新同步状态
            setTimeout(() => {
                this.updateSyncStatus();
            }, 2000);

            // 初始化搜索栏提示词和按钮
            this.updateSearchPlaceholder();
            this.updateSearchModeUI();

            this.showLoading(false);
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError(chrome.i18n.getMessage('load_bookmarks_failed') + ': ' + error.message);
            this.showLoading(false);
        }
    }

    /**
     * 加载Chrome书签并按Bookmarks Bar和Other Bookmarks分类
     */
    async loadBookmarks() {
        return new Promise((resolve, reject) => {
            try {
                chrome.bookmarks.getTree((bookmarkTree) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(`获取书签失败: ${chrome.runtime.lastError.message}`));
                        return;
                    }

                    if (!bookmarkTree || bookmarkTree.length === 0) {
                        reject(new Error('没有找到书签数据'));
                        return;
                    }

                    // 解析书签数据
                    this.parseChromeBookmarks(bookmarkTree[0].children);

                    console.log('Bookmarks Bar:', this.bookmarksBarData.folders.length, '个文件夹,', this.bookmarksBarData.bookmarks.length, '个书签');
                    console.log('Other Bookmarks:', this.otherBookmarksData.folders.length, '个文件夹,', this.otherBookmarksData.bookmarks.length, '个书签');
                    resolve();
                });
            } catch (error) {
                reject(new Error(`书签API调用失败: ${error.message}`));
            }
        });
    }

    /**
     * 解析Chrome书签树，分离Bookmarks Bar和Other Bookmarks
     */
    parseChromeBookmarks(nodes) {
        // Chrome书签树结构：
        // - Bookmarks Bar (id: "1")
        // - Other Bookmarks (id: "2")
        // - Mobile Bookmarks (id: "3")

        for (const node of nodes) {
            if (node.id === "1") {
                // Bookmarks Bar
                this.parsePrimaryNode(node, 'bookmarks_bar');
            } else if (node.id === "2") {
                // Other Bookmarks
                this.parsePrimaryNode(node, 'other_bookmarks');
            }
            // 忽略Mobile Bookmarks (id: "3")
        }
    }

    /**
     * 解析主要节点（Bookmarks Bar 或 Other Bookmarks）
     */
    parsePrimaryNode(node, type) {
        const data = type === 'bookmarks_bar' ? this.bookmarksBarData : this.otherBookmarksData;

        for (const child of node.children || []) {
            if (child.url) {
                // 顶级书签
                data.bookmarks.push({
                    id: child.id,
                    title: child.title || this.getDomainFromUrl(child.url),
                    url: child.url,
                    folderId: 'root',
                    folderPath: [],
                    favicon: this.getFaviconUrl(child.url),
                    dateAdded: child.dateAdded || Date.now()
                });
            } else if (child.children && !child.url) {
                // 文件夹
                const folder = {
                    id: child.id,
                    title: child.title || chrome.i18n.getMessage('unnamed_folder'),
                    bookmarks: []
                };

                // 递归收集文件夹中的所有书签
                this.collectFolderBookmarks(child.children, folder.bookmarks, [folder.title]);

                data.folders.push(folder);
            }
        }
    }

    /**
     * 收集文件夹下的所有书签（包括子文件夹）
     */
    collectFolderBookmarks(nodes, bookmarks, parentPath) {
        for (const node of nodes) {
            if (node.url) {
                bookmarks.push({
                    id: node.id,
                    title: node.title || this.getDomainFromUrl(node.url),
                    url: node.url,
                    folderPath: [...parentPath],
                    favicon: this.getFaviconUrl(node.url),
                    dateAdded: node.dateAdded || Date.now()
                });
            } else if (node.children) {
                // 递归收集子文件夹中的书签
                this.collectFolderBookmarks(node.children, bookmarks, [...parentPath, node.title]);
            }
        }
    }

    /**
     * 从URL获取域名
     */
    getDomainFromUrl(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch (error) {
            return url;
        }
    }

    /**
     * 获取网站favicon URL，使用Chrome官方推荐的API
     */
    getFaviconUrl(url) {
        // Chrome默认书签图标的SVG (Base64编码)
        const chromeDefaultIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjhmOWZhO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOWVjZWY7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSIzIiBmaWxsPSJ1cmwoI2dyYWQxKSIgc3Ryb2tlPSIjZGVlMmU2IiBzdHJva2Utd2lkdGg9IjAuNSIvPgogIDxyZWN0IHg9IjIiIHk9IjMiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjODY4ZTk2Ii8+CiAgPHJlY3QgeD0iMiIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IiM4NjhlOTYiLz4KICA8cmVjdCB4PSIyIiB5PSI5IiB3aWR0aD0iMTIiIGhlaWdodD0iMSIgcng9IjAuNSIgZmlsbD0iIzg2OGU5NiIvPgogIDxyZWN0IHg9IjIiIHk9IjEyIiB3aWR0aD0iOCIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjODY4ZTk2Ii8+Cjwvc3ZnPg==';

        try {
            // 使用Chrome官方推荐的favicon API
            const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
            return faviconUrl;
        } catch (error) {
            // 如果URL解析失败，返回默认图标
            return chromeDefaultIcon;
        }
    }

    /**
     * 获取当前活动数据
     */
    getCurrentData() {
        return this.currentPrimaryTab === 'bookmarks_bar' ? this.bookmarksBarData : this.otherBookmarksData;
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');

        // 一级导航切换
        document.getElementById('bookmarksBarTab').addEventListener('click', () => {
            this.switchPrimaryTab('bookmarks_bar');
        });

        document.getElementById('otherBookmarksTab').addEventListener('click', () => {
            this.switchPrimaryTab('other_bookmarks');
        });

        // 搜索模式切换
        const searchModeToggle = document.getElementById('searchModeToggle');
        if (searchModeToggle) {
            searchModeToggle.addEventListener('click', () => {
                this.toggleSearchMode();
            });
        }

        // 搜索功能
        searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });

        // 键盘事件处理
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.searchTerm && this.searchMode === 'web') {
                this.performGoogleSearch();
            }
        });

        // 清除搜索
        clearSearch.addEventListener('click', () => {
            this.clearSearch();
        });

        // 左侧导航
        document.getElementById('folderNavigation').addEventListener('click', (e) => {
            const navItem = e.target.closest('.folder-nav-item');
            if (navItem) {
                const folderId = navItem.dataset.folderId;
                this.selectFolder(folderId);
            }
        });

        // 下载按钮
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.openDownloadPage();
        });

        // 历史记录按钮
        document.getElementById('historyBtn').addEventListener('click', () => {
            this.openHistoryPage();
        });

        // 书签管理器按钮
        document.getElementById('bookmarksBtn').addEventListener('click', () => {
            this.openBookmarksPage();
        });

        // 扩展管理按钮
        document.getElementById('extensionsBtn').addEventListener('click', () => {
            this.openExtensionsPage();
        });

        // 设置按钮
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Tab键快速切换搜索模式
            if (e.key === 'Tab' && document.activeElement === searchInput) {
                e.preventDefault();
                this.toggleSearchMode();
            }

            // Ctrl+K 聚焦搜索
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }

            // Escape 清除搜索
            if (e.key === 'Escape') {
                searchInput.blur();
                if (this.searchTerm) {
                    this.clearSearch();
                }
            }
        });

        // 右键菜单事件
        this.bindContextMenuEvents();
        this.bindMobileSearchToggle();
        this.bindMobileActionsMenu();
        this.bindMobileNavigationToggle();
        this.bindResponsiveHandlers();
    }

    /**
     * 绑定右键菜单相关事件
     */
    bindContextMenuEvents() {
        // 右键菜单项点击事件
        const contextMenu = document.getElementById('contextMenu');
        const contextMenuItems = contextMenu.querySelectorAll('.context-menu-item');

        contextMenuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleContextMenuClick(action);
            });
        });

        // 点击其他地方隐藏右键菜单
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // 右键菜单事件委托（处理动态生成的书签项）
        document.addEventListener('contextmenu', (e) => {
            const bookmarkItem = e.target.closest('.bookmark-item');
            if (bookmarkItem) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY, bookmarkItem);
            }
        });

        // 键盘事件隐藏右键菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }

    /**
     * 移动端搜索栏展开按钮
     */
    bindMobileSearchToggle() {
        const toggleBtn = document.getElementById('mobileSearchToggle');
        const searchSection = document.querySelector('.search-section');
        const searchInput = document.getElementById('searchInput');
        if (!toggleBtn || !searchSection || !searchInput) return;

        const openSearch = () => {
            if (window.innerWidth > 768) return;
            searchSection.classList.add('mobile-search-active');
            requestAnimationFrame(() => searchInput.focus());
        };

        const closeSearch = () => {
            if (window.innerWidth > 768) return;
            this.closeMobileSearch();
        };

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (searchSection.classList.contains('mobile-search-active')) {
                closeSearch();
            } else {
                openSearch();
            }
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            if (!searchSection.contains(e.target)) {
                closeSearch();
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            if (window.innerWidth > 768) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                this.closeMobileSearch();
                searchInput.blur();
            }
        });
    }

    /**
     * 绑定移动端操作菜单
     */
    bindMobileActionsMenu() {
        const toggleBtn = document.getElementById('mobileActionsToggle');
        const actions = document.getElementById('headerActions');
        if (!toggleBtn || !actions) return;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            actions.classList.toggle('open');
            toggleBtn.classList.toggle('active', actions.classList.contains('open'));
        });

        document.addEventListener('click', (e) => {
            if (!actions.contains(e.target) && !toggleBtn.contains(e.target)) {
                this.closeMobileActionsMenu();
            }
        });
    }

    /**
     * 绑定移动端导航折叠
     */
    bindMobileNavigationToggle() {
        const toggleBtn = document.getElementById('mobileNavToggle');
        const sidebar = document.querySelector('.secondary-navigation');
        const backdrop = document.getElementById('navBackdrop');
        if (!toggleBtn || !sidebar) return;

        const toggleNav = (e) => {
            if (window.innerWidth > 768) return;
            if (e) {
                e.stopPropagation();
            }
            const isOpen = sidebar.classList.toggle('open');
            toggleBtn.classList.toggle('active', isOpen);
            if (backdrop) {
                backdrop.classList.toggle('show', isOpen);
            }
        };

        toggleBtn.addEventListener('click', toggleNav);
        backdrop?.addEventListener('click', () => this.closeMobileNavigationPanel());

        document.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return;
            if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
                this.closeMobileNavigationPanel();
            }
        });
    }

    /**
     * 绑定窗口尺寸变化
     */
    bindResponsiveHandlers() {
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeMobileNavigationPanel();
                this.closeMobileActionsMenu();
                this.closeMobileSearch();
            }
        });
    }

    /**
     * 关闭移动端导航抽屉
     */
    closeMobileNavigationPanel() {
        const sidebar = document.querySelector('.secondary-navigation');
        const toggleBtn = document.getElementById('mobileNavToggle');
        const backdrop = document.getElementById('navBackdrop');
        sidebar?.classList.remove('open');
        toggleBtn?.classList.remove('active');
        backdrop?.classList.remove('show');
    }

    /**
     * 关闭移动端操作菜单
     */
    closeMobileActionsMenu() {
        const actions = document.getElementById('headerActions');
        const toggleBtn = document.getElementById('mobileActionsToggle');
        actions?.classList.remove('open');
        toggleBtn?.classList.remove('active');
    }

    /**
     * 关闭移动端搜索框
     */
    closeMobileSearch() {
        const searchSection = document.querySelector('.search-section');
        if (searchSection) {
            searchSection.classList.remove('mobile-search-active');
        }
    }

    /**
     * 更新移动端面包屑
     */
    updateMobileBreadcrumb() {
        const label = document.getElementById('mobileNavLabel');
        if (!label) return;

        const primaryLabel = this.currentPrimaryTab === 'bookmarks_bar'
            ? t('bookmarks_bar')
            : t('other_bookmarks');

        let detailLabel = t('all_bookmarks');
        const data = this.getCurrentData();
        if (this.currentFolderId && this.currentFolderId !== 'root' && data?.folders) {
            const folder = data.folders.find(f => f.id === this.currentFolderId);
            if (folder) {
                detailLabel = folder.title;
            }
        }

        label.textContent = `${primaryLabel} › ${detailLabel}`;
    }

    /**
     * 切换主标签
     */
    switchPrimaryTab(tab) {
        if (this.currentPrimaryTab === tab) return;

        this.currentPrimaryTab = tab;
        this.currentFolderId = null;

        // 更新一级导航状态
        document.querySelectorAll('.primary-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeTab = tab === 'bookmarks_bar' ?
            document.getElementById('bookmarksBarTab') :
            document.getElementById('otherBookmarksTab');

        activeTab.classList.add('active');

        // 更新二级导航标题
        const navTitle = document.getElementById('secondaryNavTitle');
        navTitle.textContent = tab === 'bookmarks_bar' ? chrome.i18n.getMessage('bookmarks_bar_folders') : chrome.i18n.getMessage('other_bookmarks_folders');

        // 重新渲染界面（保持搜索状态）
        this.renderNavigation();
        this.renderBookmarkContent();
    }

    /**
     * 切换搜索模式
     */
    toggleSearchMode() {
        // 切换搜索模式
        this.searchMode = this.searchMode === 'bookmark' ? 'web' : 'bookmark';

        this.updateSearchModeUI();
        this.updateSearchPlaceholder();

        // 处理搜索状态
        if (this.searchTerm) {
            if (this.searchMode === 'bookmark') {
                this.renderBookmarkContent();
            } else {
                // 网络搜索模式下隐藏书签内容
                document.getElementById('bookmarkSections').innerHTML = '';
                document.getElementById('emptyState').classList.add('hidden');
            }
        }
    }

    /**
     * 设置搜索模式
     */
    setSearchMode(mode) {
        if (this.searchMode === mode) return;

        this.searchMode = mode;
        this.updateSearchModeUI();
        this.updateSearchPlaceholder();

        // 处理搜索状态
        if (this.searchTerm) {
            if (mode === 'bookmark') {
                this.renderBookmarkContent();
            } else {
                document.getElementById('bookmarkSections').innerHTML = '';
                document.getElementById('emptyState').classList.add('hidden');
            }
        }
    }

    /**
     * 更新搜索模式UI
     */
    updateSearchModeUI() {
        const toggleBtn = document.getElementById('searchModeToggle');
        const searchIcon = toggleBtn?.querySelector('.search-icon');
        const webIcon = toggleBtn?.querySelector('.web-icon');

        if (searchIcon && webIcon) {
            if (this.searchMode === 'bookmark') {
                searchIcon.style.display = 'block';
                webIcon.style.display = 'none';
            } else {
                searchIcon.style.display = 'none';
                webIcon.style.display = 'block';
            }
        }
    }

    /**
     * 处理搜索输入
     */
    handleSearchInput(value) {
        this.searchTerm = value.trim();
        const clearBtn = document.getElementById('clearSearch');
        clearBtn.classList.toggle('hidden', !this.searchTerm);

        if (this.searchMode === 'bookmark') {
            this.renderBookmarkContent();
        }
    }

    /**
     * 清除搜索
     */
    clearSearch() {
        this.searchTerm = '';
        const searchInput = document.getElementById('searchInput');
        searchInput.value = '';
        document.getElementById('clearSearch').classList.add('hidden');
        this.renderBookmarkContent();
    }

    /**
     * 执行搜索引擎搜索
     */
    performGoogleSearch() {
        if (this.searchTerm) {
            const searchUrl = this.searchEngineUrls[this.settings.searchEngine];
            window.open(`${searchUrl}${encodeURIComponent(this.searchTerm)}`, '_blank');
        }
    }

    /**
     * 选择文件夹
     */
    selectFolder(folderId) {
        this.currentFolderId = folderId;

        // 更新导航状态
        document.querySelectorAll('.folder-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeItem = document.querySelector(`[data-folder-id="${folderId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // 滚动到对应的分组
        this.scrollToSection(folderId);
        this.updateMobileBreadcrumb();
        this.closeMobileNavigationPanel();
    }

    /**
     * 滚动到指定分组
     */
    scrollToSection(folderId) {
        if (folderId === 'root') {
            const container = document.querySelector('.bookmark-content');
            if (container) {
                this.smoothScroll(container, 0);
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        const section = document.getElementById(`section-${folderId}`);
        if (!section) {
            return;
        }

        const container = document.querySelector('.bookmark-content');
        if (!container) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const computedStyle = window.getComputedStyle(section);
        const scrollMarginTop = parseInt(computedStyle.scrollMarginTop, 10) || 0;
        const sectionRect = section.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offsetWithinContainer = sectionRect.top - containerRect.top;
        const targetY = Math.max(offsetWithinContainer + container.scrollTop - scrollMarginTop, 0);

        this.smoothScroll(container, targetY);
    }

    /**
     * 自定义滚动动画，提升跳转速度的同时保留平滑过渡
     */
    smoothScroll(container, targetY, duration = 220) {
        if (!container) return;

        if (this.scrollAnimationFrame) {
            cancelAnimationFrame(this.scrollAnimationFrame);
            this.scrollAnimationFrame = null;
        }

        const startY = container.scrollTop;
        const distance = targetY - startY;
        const startTime = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutCubic(progress);
            container.scrollTop = startY + distance * easedProgress;

            if (progress < 1) {
                this.scrollAnimationFrame = requestAnimationFrame(step);
            } else {
                this.scrollAnimationFrame = null;
            }
        };

        this.scrollAnimationFrame = requestAnimationFrame(step);
    }

    /**
     * 渲染整个界面
     */
    render() {
        this.renderNavigation();
        this.renderPinnedSection(); // 渲染置顶区域
        this.renderBookmarkContent();
    }

    /**
     * 渲染左侧导航
     */
    renderNavigation() {
        const navigation = document.getElementById('folderNavigation');
        const data = this.getCurrentData();

        // 添加"全部"导航项
        let html = `
            <li class="folder-nav-item ${!this.currentFolderId ? 'active' : ''}" data-folder-id="root">
                <div class="nav-item-content">
                    <svg class="nav-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                    <span class="nav-folder-name">${t('all_bookmarks')}</span>
                    <span class="nav-bookmark-count">${this.calculateTotalBookmarks(data)}</span>
                </div>
            </li>
        `;

        // 添加文件夹导航
        data.folders.forEach(folder => {
            const isActive = this.currentFolderId === folder.id;

            html += `
                <li class="folder-nav-item ${isActive ? 'active' : ''}" data-folder-id="${folder.id}">
                    <div class="nav-item-content">
                        <svg class="nav-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                        </svg>
                        <span class="nav-folder-name">${this.escapeHtml(folder.title)}</span>
                        <span class="nav-bookmark-count">${folder.bookmarks.length}</span>
                    </div>
                </li>
            `;
        });

        navigation.innerHTML = html;

        // 更新文件夹数量
        const totalBookmarks = this.calculateTotalBookmarks(data);
        document.getElementById('folderCount').textContent = totalBookmarks;
        this.updateMobileBreadcrumb();
    }

    /**
     * 计算当前数据下的总书签数
     */
    calculateTotalBookmarks(data) {
        if (!data) return 0;
        const folderBookmarks = data.folders.reduce((sum, folder) => sum + (folder.bookmarks?.length || 0), 0);
        return (data.bookmarks?.length || 0) + folderBookmarks;
    }

    /**
     * 渲染书签内容
     */
    renderBookmarkContent() {
        const bookmarkSections = document.getElementById('bookmarkSections');
        const emptyState = document.getElementById('emptyState');

        // 如果是网络搜索模式且有搜索词，不显示书签，隐藏空状态
        if (this.searchMode === 'web' && this.searchTerm) {
            bookmarkSections.innerHTML = '';
            emptyState.classList.add('hidden');
            return;
        }

        const data = this.getCurrentData();
        let sections = [];
        let hasContent = false;

        // 如果有搜索词，过滤书签
        if (this.searchTerm && this.searchMode === 'bookmark') {
            const filteredBookmarks = this.filterBookmarks(data);
            hasContent = filteredBookmarks.length > 0;

            if (hasContent) {
                sections = [{
                    id: 'search_results',
                    title: t('search_results_title'),
                    bookmarks: filteredBookmarks
                }];
            }
        } else {
            // 正常显示模式
            // 先检查顶级书签
            if (data.bookmarks.length > 0) {
                sections.push({
                    id: 'root',
                    title: t('bookmarks_bar_title'),
                    bookmarks: data.bookmarks
                });
                hasContent = true;
            }

            // 然后检查文件夹书签
            data.folders.forEach(folder => {
                if (folder.bookmarks.length > 0) {
                    sections.push({
                        id: folder.id,
                        title: folder.title,
                        bookmarks: folder.bookmarks
                    });
                    hasContent = true;
                }
            });
        }

        // 根据是否有内容显示相应内容
        if (!hasContent) {
            // 没有内容时显示空状态
            bookmarkSections.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.updateEmptyState();
        } else {
            // 有内容时隐藏空状态并显示书签
            emptyState.classList.add('hidden');
            let html = sections.map(section => this.renderBookmarkSection(section)).join('');
            bookmarkSections.innerHTML = html;

            // 绑定书签事件
            this.bindBookmarkEvents();
        }
    }

    /**
     * 过滤书签
     */
    filterBookmarks(data) {
        const searchTerm = this.searchTerm.toLowerCase();
        let allBookmarks = [...data.bookmarks];

        data.folders.forEach(folder => {
            allBookmarks = allBookmarks.concat(folder.bookmarks);
        });

        return allBookmarks.filter(bookmark =>
            bookmark.title.toLowerCase().includes(searchTerm) ||
            bookmark.url.toLowerCase().includes(searchTerm) ||
            bookmark.folderPath.some(path => path.toLowerCase().includes(searchTerm))
        );
    }

    /**
     * 渲染单个书签分组
     */
    renderBookmarkSection(section) {
        const html = `
            <div class="bookmark-section" id="section-${section.id}">
                <div class="bookmark-section-header">
                    <h2 class="bookmark-section-title">
                        <svg class="bookmark-section-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                        </svg>
                        ${this.escapeHtml(section.title)}
                    </h2>
                    <span class="bookmark-section-count">${section.bookmarks.length}</span>
                </div>
                <div class="bookmark-list">
                    ${section.bookmarks.map(bookmark => this.renderBookmarkItem(bookmark)).join('')}
                </div>
            </div>
        `;

        return html;
    }

    /**
     * 渲染单个书签项
     */
    renderBookmarkItem(bookmark) {
        const isPinned = this.isBookmarkedPinned(bookmark.url);
        const pinnedClass = isPinned ? ' pinned' : '';
        return `
            <div class="bookmark-item${pinnedClass}" data-url="${bookmark.url}" data-id="${bookmark.id}">
                <div class="bookmark-favicon">
                    <img src="${bookmark.favicon}" alt="${bookmark.title}" loading="lazy"
                         style="width: 24px; height: 24px; border-radius: 4px;">
                </div>
                <div class="bookmark-info">
                    <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
                </div>
                <div class="bookmark-actions">
                    <button class="action-btn copy-url" title="复制链接" data-url="${bookmark.url}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                    </button>
                    <button class="action-btn open-new" title="新标签页打开" data-url="${bookmark.url}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 获取Chrome风格的默认favicon SVG
     */
    getDefaultFaviconSvg() {
        // Chrome默认书签图标的SVG (直接内嵌)
        return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjhmOWZhO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOWVjZWY7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSIzIiBmaWxsPSJ1cmwoI2dyYWQxKSIgc3Ryb2tlPSIjZGVlMmU2IiBzdHJva2Utd2lkdGg9IjAuNSIvPgogIDxyZWN0IHg9IjIiIHk9IjMiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjODY4ZTk2Ii8+CiAgPHJlY3QgeD0iMiIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IiM4NjhlOTYiLz4KICA8cmVjdCB4PSIyIiB5PSI5IiB3aWR0aD0iMTIiIGhlaWdodD0iMSIgcng9IjAuNSIgZmlsbD0iIzg2OGU5NiIvPgogIDxyZWN0IHg9IjIiIHk9IjEyIiB3aWR0aD0iOCIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjODY4ZTk2Ii8+Cjwvc3ZnPg==';
    }

    /**
     * 绑定书签事件
     */
    bindBookmarkEvents() {
        document.querySelectorAll('.bookmark-item').forEach(item => {
            this.bindBookmarkItemEvents(item);
        });
    }

    bindBookmarkItemEvents(item) {
        if (!item || item.dataset.eventsBound === 'true') {
            return;
        }
        item.dataset.eventsBound = 'true';

        // 应用图标颜色到卡片背景
        this.applyFaviconColorToCard(item);

        item.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-actions')) {
                return;
            }

            const url = item.dataset.url;
            if (e.ctrlKey || e.metaKey) {
                if (chrome.tabs && chrome.tabs.create) {
                    chrome.tabs.create({ url });
                } else {
                    window.open(url, '_blank');
                }
            } else {
                window.location.href = url;
            }
        });

        // 操作按钮事件
        const copyBtn = item.querySelector('.copy-url');
        const newTabBtn = item.querySelector('.open-new');

        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(copyBtn.dataset.url);
                // showToast已在copyToClipboard方法中处理
            });
        }

        if (newTabBtn) {
            newTabBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (chrome.tabs && chrome.tabs.create) {
                    chrome.tabs.create({ url: newTabBtn.dataset.url });
                } else {
                    window.open(newTabBtn.dataset.url, '_blank');
                }
            });
        }
    }

    /**
     * 从图标提取主题色并应用到卡片背景
     */
    async applyFaviconColorToCard(item) {
        const img = item.querySelector('.bookmark-favicon img');
        if (!img) {
            return;
        }

        // 如果图片还未加载完成，等待加载
        if (!img.complete) {
            img.addEventListener('load', () => this.extractAndApplyColor(img, item));
            img.addEventListener('error', () => {
                // 图片加载失败时，使用默认背景
                console.warn('图标加载失败，使用默认背景');
            });
            return;
        }

        // 检查图片是否自然尺寸为0（可能是加载失败）
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            console.warn('图标尺寸无效，使用默认背景');
            return;
        }

        this.extractAndApplyColor(img, item);
    }

    /**
     * 提取图片主色调并应用到卡片
     */
    extractAndApplyColor(img, item) {
        try {
            // 创建 canvas 来分析图片颜色
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                console.warn('无法创建 canvas context');
                return;
            }

            const size = 32; // 使用小尺寸进行分析，提高性能
            canvas.width = size;
            canvas.height = size;

            // 绘制图片到 canvas
            try {
                ctx.drawImage(img, 0, 0, size, size);
            } catch (e) {
                // 可能是 CORS 问题
                console.warn('绘制图片到 canvas 失败（可能是 CORS 问题）:', e);
                return;
            }

            // 获取图片数据
            let imageData;
            try {
                imageData = ctx.getImageData(0, 0, size, size);
            } catch (e) {
                // CORS 错误
                console.warn('获取图片数据失败（CORS 限制）:', e);
                return;
            }

            const data = imageData.data;

            // 统计颜色
            const colorCounts = {};
            let maxCount = 0;
            let dominantColor = { r: 0, g: 0, b: 0 };

            // 采样步长（跳过一些像素提高性能）
            const step = 4;

            for (let i = 0; i < data.length; i += 4 * step) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                // 跳过透明像素
                if (a < 128) continue;

                // 跳过接近白色或黑色的颜色
                const brightness = (r + g + b) / 3;
                if (brightness > 240 || brightness < 15) continue;

                // 将颜色量化到相近的值（减少颜色数量）
                const quantize = (val) => Math.round(val / 16) * 16;
                const key = `${quantize(r)}-${quantize(g)}-${quantize(b)}`;

                if (!colorCounts[key]) {
                    colorCounts[key] = { r, g, b, count: 0 };
                }
                colorCounts[key].count++;

                if (colorCounts[key].count > maxCount) {
                    maxCount = colorCounts[key].count;
                    dominantColor = colorCounts[key];
                }
            }

            // 如果没有找到合适的颜色，使用默认灰色
            if (maxCount === 0) {
                dominantColor = { r: 128, g: 128, b: 128 };
            }

            // 应用颜色到卡片背景（5%透明度）
            const rgbColor = `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.05)`;
            item.style.setProperty('--favicon-color', rgbColor);
            item.style.backgroundColor = 'var(--favicon-color)';

        } catch (error) {
            console.error('提取图标颜色失败:', error);
            // 出错时使用默认背景（不做任何操作）
        }
    }

    /**
     * 更新空状态
     */
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const titleElement = emptyState.querySelector('h3');
        const descElement = emptyState.querySelector('p');

        if (this.searchMode === 'bookmark' && this.searchTerm) {
            titleElement.textContent = t('no_matching_bookmarks');
            descElement.textContent = t('no_matching_bookmarks_desc', this.searchTerm);
        } else {
            titleElement.textContent = t('no_bookmarks');
            descElement.textContent = t('no_bookmarks_desc');
        }
    }

    /**
     * 显示/隐藏加载状态
     */
    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const bookmarkSections = document.getElementById('bookmarkSections');
        const emptyState = document.getElementById('emptyState');

        bookmarkSections.innerHTML = '';
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h3').textContent = t('error_title');
        emptyState.querySelector('p').textContent = message;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 打开下载页面
     */
    openDownloadPage() {
        if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({
                url: 'chrome://downloads'
            });
        } else {
            window.open('chrome://downloads', '_blank');
        }
    }

    /**
     * 打开历史记录页面
     */
    openHistoryPage() {
        if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({
                url: 'chrome://history'
            });
        } else {
            window.open('chrome://history', '_blank');
        }
    }

    /**
     * 打开书签管理器页面
     */
    openBookmarksPage() {
        if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({
                url: 'chrome://bookmarks'
            });
        } else {
            window.open('chrome://bookmarks', '_blank');
        }
    }

    /**
     * 打开扩展管理页面
     */
    openExtensionsPage() {
        if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({
                url: 'chrome://extensions'
            });
        } else {
            window.open('chrome://extensions', '_blank');
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['marklauncher_settings'], (result) => {
                if (result.marklauncher_settings) {
                    this.settings = { ...this.settings, ...result.marklauncher_settings };
                }
                resolve();
            });
        });
    }

    /**
     * 保存设置
     */
    async saveSettings(options = {}) {
        const silent = typeof options === 'boolean' ? options : !!options.silent;

        return new Promise((resolve) => {
            chrome.storage.sync.set({ marklauncher_settings: this.settings }, () => {
                if (chrome.runtime.lastError) {
                    console.error('保存设置失败:', chrome.runtime.lastError);
                } else {
                    if (!silent) {
                        this.showToast(t('settings_saved'));
                    }
                }
                resolve();
            });
        });
    }

    /**
     * 打开设置弹窗
     */
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.add('show');

        // 设置当前选中的搜索引擎
        const searchEngineRadio = document.querySelector(`input[name="searchEngine"][value="${this.settings.searchEngine}"]`);
        if (searchEngineRadio) {
            searchEngineRadio.checked = true;
        }

        const themeRadio = document.querySelector(`input[name="themePreference"][value="${this.settings.theme}"]`);
        if (themeRadio) {
            themeRadio.checked = true;
        }

        // 更新设置面板中的国际化文本
        this.updateI18nElements();
        this.highlightActiveThemeOption(this.settings.theme);

        this.bindSettingsEvents();
    }

    /**
     * 关闭设置弹窗
     */
    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('show');
    }

    /**
     * 绑定设置相关事件
     */
    bindSettingsEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('closeSettingsBtn');
        closeBtn.onclick = () => this.closeSettingsModal();

        // 点击遮罩层关闭
        const overlay = document.querySelector('.settings-overlay');
        overlay.onclick = () => this.closeSettingsModal();

        // 左侧导航切换
        const navItems = document.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            item.onclick = () => {
                const panelName = item.dataset.panel;
                this.switchSettingsPanel(panelName);
            };
        });

        // 搜索引擎选择
        const searchEngineRadios = document.querySelectorAll('input[name="searchEngine"]');
        searchEngineRadios.forEach(radio => {
            radio.onchange = (e) => {
                if (e.target.checked) {
                    this.settings.searchEngine = e.target.value;
                    this.saveSettings();
                    this.updateSearchPlaceholder();
                }
            };
        });

        // 主题选择
        const themeRadios = document.querySelectorAll('input[name="themePreference"]');
        themeRadios.forEach(radio => {
            radio.onchange = (e) => {
                if (e.target.checked) {
                    this.applyTheme(e.target.value);
                    this.saveSettings();
                }
            };
        });
    }

    /**
     * 切换设置面板
     */
    switchSettingsPanel(panelName) {
        // 更新导航状态
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');

        // 更新面板显示
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        if (panelName === 'search') {
            document.getElementById('searchPanel').classList.add('active');
        } else if (panelName === 'appearance') {
            document.getElementById('appearancePanel').classList.add('active');
        } else if (panelName === 'about') {
            document.getElementById('aboutPanel').classList.add('active');
        }
    }

    /**
     * 更新搜索栏提示词
     */
    updateSearchPlaceholder() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        // 根据当前搜索模式更新提示词
        if (this.searchMode === 'bookmark') {
            searchInput.placeholder = t('search_bookmarks');
        } else {
            // 获取搜索引擎的翻译名称
            const engineKey = 'search_on_' + this.settings.searchEngine;
            searchInput.placeholder = t(engineKey);
        }
    }

    /**
     * 更新搜索模式按钮文本
     */
    
    /**
     * 显示提示消息
     */
    showToast(message, duration = 2000) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        // 使用样式类而不是内联样式
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 24px;
            background: rgba(33, 37, 41, 0.95);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 300px;
            word-wrap: break-word;
        `;

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                animation: toastSlideIn 0.3s ease-out;
                opacity: 0;
                transform: translateY(-10px);
            }

            @keyframes toastSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .toast.hiding {
                animation: toastSlideOut 0.3s ease-out forwards;
            }

            @keyframes toastSlideOut {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px);
                }
            }
        `;

        // 移除旧的样式（如果存在）
        const oldStyles = document.querySelectorAll('style[data-toast]');
        oldStyles.forEach(oldStyle => oldStyle.remove());

        style.setAttribute('data-toast', 'true');
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.remove('hiding');
        });

        // 自动隐藏
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
                if (style.parentNode) {
                    style.remove();
                }
            }, 300);
        }, duration);
    }

    // ========== 通知系统 ==========

    /**
     * 显示通知消息
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型: 'success', 'warning', 'error', 'info'
     * @param {number} duration - 显示时长(毫秒)，0表示不自动关闭
     */
    showNotification(message, type = 'info', duration = 4000) {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        // 图标
        const iconMap = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        // 构建通知HTML
        notification.innerHTML = `
            <div class="notification-icon">${iconMap[type] || iconMap.info}</div>
            <div class="notification-content">
                <div class="notification-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="notification-close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        // 添加到容器
        container.appendChild(notification);

        // 绑定关闭按钮事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }
    }

    /**
     * 移除通知
     */
    removeNotification(notification) {
        if (!notification || !notification.parentNode) return;
        notification.classList.add('removing');
        notification.addEventListener('animationend', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    // ========== 同步状态检测 ==========

    /**
     * 检查Chrome同步是否可用
     */
    async checkSyncAvailable() {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.sync) {
                resolve({ available: false, error: 'Chrome Storage API 不可用' });
                return;
            }

            // 尝试写入测试数据
            chrome.storage.sync.set({ _sync_test: Date.now() }, () => {
                if (chrome.runtime.lastError) {
                    resolve({
                        available: false,
                        error: chrome.runtime.lastError.message || '同步服务不可用'
                    });
                } else {
                    // 清理测试数据
                    chrome.storage.sync.remove('_sync_test', () => {
                        resolve({ available: true });
                    });
                }
            });
        });
    }

    /**
     * 更新UI上的同步状态指示器
     */
    async updateSyncStatus() {
        const indicator = document.getElementById('syncStatusIndicator');
        const description = document.getElementById('syncStatusDescription');

        if (!indicator || !description) return;

        // 显示"检查中"状态
        indicator.className = 'sync-status-indicator';
        indicator.innerHTML = `<span class="sync-status-icon">⋯</span><span class="sync-status-text">${this.escapeHtml(chrome.i18n.getMessage('sync_checking'))}</span>`;
        description.textContent = chrome.i18n.getMessage('sync_checking_status');

        // 检查同步可用性
        const result = await this.checkSyncAvailable();

        if (result.available) {
            // 同步可用
            indicator.className = 'sync-status-indicator sync-ok';
            indicator.innerHTML = `<span class="sync-status-icon">✓</span><span class="sync-status-text">${this.escapeHtml(chrome.i18n.getMessage('sync_enabled'))}</span>`;
            description.textContent = chrome.i18n.getMessage('sync_enabled_desc');
        } else {
            // 同步不可用
            indicator.className = 'sync-status-indicator sync-warning';
            indicator.innerHTML = `<span class="sync-status-icon">!</span><span class="sync-status-text">${this.escapeHtml(chrome.i18n.getMessage('sync_disabled'))}</span>`;

            // 根据错误信息显示不同的提示
            let desc = chrome.i18n.getMessage('sync_disabled_desc');
            if (result.error) {
                if (result.error.includes('QUOTA') || result.error.includes('quota')) {
                    desc = chrome.i18n.getMessage('sync_quota_error');
                } else {
                    desc = chrome.i18n.getMessage('sync_network_error').replace('$1', result.error);
                }
            }
            description.textContent = desc;
        }
    }

    // ========== 置顶功能相关方法 ==========

    /**
     * 加载置顶书签数据
     */
    async loadPinnedBookmarks() {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.sync) {
                console.error('Chrome Storage API 不可用');
                // 显示警告通知
                setTimeout(() => {
                    this.showNotification('置顶数据无法加载：Chrome 同步功能不可用', 'warning');
                }, 1000);
                resolve();
                return;
            }

            chrome.storage.sync.get(['marklauncher_pinned_bookmarks'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('加载置顶书签失败:', chrome.runtime.lastError);
                    // 显示错误通知
                    setTimeout(() => {
                        this.showNotification('置顶数据加载失败：' + chrome.runtime.lastError.message, 'error');
                    }, 1000);
                } else if (result.marklauncher_pinned_bookmarks) {
                    this.pinnedBookmarks = result.marklauncher_pinned_bookmarks;
                }
                resolve();
            });
        });
    }

    /**
     * 从localStorage加载置顶书签
     */
    loadPinnedBookmarksFromLocalStorage() {
        try {
            const saved = localStorage.getItem('marklauncher_pinned_bookmarks');
            if (saved) {
                this.pinnedBookmarks = JSON.parse(saved);
            }
        } catch (localError) {
            console.error('从localStorage加载置顶书签失败:', localError);
            this.pinnedBookmarks = [];
        }
    }

    /**
     * 保存置顶书签数据
     */
    async savePinnedBookmarks() {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.sync) {
                console.error('Chrome Storage API 不可用');
                this.showNotification('置顶数据无法保存：Chrome 同步功能不可用', 'error');
                resolve();
                return;
            }

            chrome.storage.sync.set({ marklauncher_pinned_bookmarks: this.pinnedBookmarks }, () => {
                if (chrome.runtime.lastError) {
                    console.error('保存置顶书签失败:', chrome.runtime.lastError);
                    // 显示错误通知，但不自动降级到localStorage
                    let errorMsg = '置顶数据同步失败';
                    if (chrome.runtime.lastError.message) {
                        if (chrome.runtime.lastError.message.includes('QUOTA')) {
                            errorMsg = '同步存储空间不足';
                        } else {
                            errorMsg = '置顶数据同步失败：' + chrome.runtime.lastError.message;
                        }
                    }
                    this.showNotification(errorMsg + '，请检查网络连接或登录 Chrome 账户', 'warning');
                } else {
                    // 保存成功，显示成功提示
                    // this.showNotification('置顶数据已同步', 'success', 2000);
                }
                resolve();
            });
        });
    }

    /**
     * 保存置顶书签到localStorage
     */
    savePinnedBookmarksToLocalStorage() {
        try {
            localStorage.setItem('marklauncher_pinned_bookmarks', JSON.stringify(this.pinnedBookmarks));
        } catch (localError) {
            console.error('保存置顶书签到localStorage失败:', localError);
        }
    }

    /**
     * 置顶书签
     * @param {string} bookmarkUrl - 书签URL
     */
    async pinBookmark(bookmarkUrl) {
        if (!this.pinnedBookmarks.includes(bookmarkUrl)) {
            this.pinnedBookmarks.push(bookmarkUrl);
            await this.savePinnedBookmarks();
            this.renderPinnedSection();
            // 通过URL找到对应的书签ID并刷新
            const bookmark = this.getBookmarkByUrl(bookmarkUrl);
            if (bookmark) {
                this.refreshBookmarkItem(bookmark.id);
            }
        }
    }

    /**
     * 取消置顶书签
     * @param {string} bookmarkUrl - 书签URL
     */
    async unpinBookmark(bookmarkUrl) {
        const index = this.pinnedBookmarks.indexOf(bookmarkUrl);
        if (index > -1) {
            this.pinnedBookmarks.splice(index, 1);
            await this.savePinnedBookmarks();
            this.renderPinnedSection();
            // 通过URL找到对应的书签ID并刷新
            const bookmark = this.getBookmarkByUrl(bookmarkUrl);
            if (bookmark) {
                this.refreshBookmarkItem(bookmark.id);
            }
        }
    }

    /**
     * 检查书签是否已置顶
     * @param {string} bookmarkUrl - 书签URL
     */
    isBookmarkedPinned(bookmarkUrl) {
        return this.pinnedBookmarks.includes(bookmarkUrl);
    }

    /**
     * 通过URL获取书签
     * @param {string} url - 书签URL
     */
    getBookmarkByUrl(url) {
        const allBookmarks = this.getAllBookmarks();
        return allBookmarks.find(bookmark => bookmark.url === url) || null;
    }

    /**
     * 获取所有置顶书签的完整信息
     */
    getPinnedBookmarksData() {
        const allBookmarks = this.getAllBookmarks();
        return this.pinnedBookmarks
            .map(url => allBookmarks.find(bookmark => bookmark.url === url))
            .filter(bookmark => bookmark !== undefined); // 过滤掉可能已删除的书签
    }

    /**
     * 获取所有书签（包括书签栏和其他书签）
     */
    getAllBookmarks() {
        let allBookmarks = [...this.bookmarksBarData.bookmarks, ...this.otherBookmarksData.bookmarks];

        // 添加所有文件夹中的书签
        this.bookmarksBarData.folders.forEach(folder => {
            allBookmarks.push(...folder.bookmarks);
        });

        this.otherBookmarksData.folders.forEach(folder => {
            allBookmarks.push(...folder.bookmarks);
        });

        return allBookmarks;
    }

    getBookmarkById(bookmarkId) {
        return this.getAllBookmarks().find(bookmark => bookmark.id === bookmarkId) || null;
    }

    refreshBookmarkItem(bookmarkId) {
        const existingItem = document.querySelector(`.bookmark-item[data-id="${bookmarkId}"]`);
        if (!existingItem) {
            return;
        }

        const bookmarkData = this.getBookmarkById(bookmarkId);
        if (!bookmarkData) {
            return;
        }

        const temp = document.createElement('div');
        temp.innerHTML = this.renderBookmarkItem(bookmarkData).trim();
        const newItem = temp.firstElementChild;
        existingItem.replaceWith(newItem);
        this.bindBookmarkItemEvents(newItem);
    }

    /**
     * 渲染置顶区域
     */
    renderPinnedSection() {
        const pinnedSection = document.getElementById('pinnedSection');
        const pinnedList = document.getElementById('pinnedList');
        const pinnedCount = document.getElementById('pinnedCount');

        const pinnedBookmarksData = this.getPinnedBookmarksData();

        if (pinnedBookmarksData.length === 0) {
            pinnedSection.style.display = 'none';
            pinnedCount.textContent = '0';
            pinnedList.innerHTML = '';
            return;
        }

        pinnedSection.style.display = 'block';
        pinnedCount.textContent = pinnedBookmarksData.length;

        pinnedList.innerHTML = pinnedBookmarksData
            .map(bookmark => this.renderBookmarkItem(bookmark))
            .join('');
        this.bindBookmarkEvents();
    }

    /**
     * 显示右键菜单
     */
    showContextMenu(x, y, bookmarkItem) {
        const contextMenu = document.getElementById('contextMenu');
        const pinAction = contextMenu.querySelector('[data-action="pin"]');
        const unpinAction = contextMenu.querySelector('[data-action="unpin"]');

        this.contextMenuTarget = bookmarkItem;
        const bookmarkUrl = bookmarkItem.dataset.url;
        const isPinned = this.isBookmarkedPinned(bookmarkUrl);

        // 根据置顶状态显示/隐藏对应选项
        pinAction.style.display = isPinned ? 'none' : 'flex';
        unpinAction.style.display = isPinned ? 'flex' : 'none';

        // 设置菜单位置
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.style.display = 'block';

        // 确保菜单不会超出视窗
        this.adjustContextMenuPosition(contextMenu);
    }

    /**
     * 隐藏右键菜单
     */
    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'none';
        this.contextMenuTarget = null;
    }

    /**
     * 调整右键菜单位置，防止超出视窗
     */
    adjustContextMenuPosition(menu) {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = parseInt(menu.style.left);
        let top = parseInt(menu.style.top);

        // 防止右边溢出
        if (rect.right > viewportWidth) {
            left = left - (rect.right - viewportWidth);
            menu.style.left = left + 'px';
        }

        // 防止下边溢出
        if (rect.bottom > viewportHeight) {
            top = top - (rect.bottom - viewportHeight);
            menu.style.top = top + 'px';
        }

        // 防止左边溢出
        if (left < 0) {
            menu.style.left = '0px';
        }

        // 防止上边溢出
        if (top < 0) {
            menu.style.top = '0px';
        }
    }

    /**
     * 处理右键菜单点击
     */
    handleContextMenuClick(action) {
        if (!this.contextMenuTarget) return;

        const bookmarkUrl = this.contextMenuTarget.dataset.url;
        const bookmarkTitle = this.contextMenuTarget.querySelector('.bookmark-title')?.textContent || '未知网站';

        switch (action) {
            case 'pin':
                this.pinBookmark(bookmarkUrl);
                break;
            case 'unpin':
                this.unpinBookmark(bookmarkUrl);
                break;
            case 'qrcode':
                this.showQRCodeModal(bookmarkUrl, bookmarkTitle);
                break;
        }

        this.hideContextMenu();
    }

    // ========== 二维码分享功能 ==========

    /**
     * 显示二维码分享弹窗
     */
    showQRCodeModal(url, title) {
        const modal = document.getElementById('qrcodeModal');
        const qrcodeCanvas = document.getElementById('qrcodeCanvas');
        const titleElement = document.getElementById('qrcodeTitle');
        const urlElement = document.getElementById('qrcodeUrl');
        const faviconElement = document.getElementById('qrcodeFavicon').querySelector('img');

        // 设置网站信息
        titleElement.textContent = title;
        urlElement.textContent = url;

        // 设置网站图标
        const faviconUrl = this.getFaviconUrl(url);
        faviconElement.src = faviconUrl;
        faviconElement.alt = title;
        // Chrome favicon API 不需要错误处理，因为Chrome会自动处理
        // 删除了 onerror 处理器

        // 清空之前的二维码
        qrcodeCanvas.innerHTML = '';

        // 生成二维码
        this.generateQRCode(url, qrcodeCanvas);

        // 显示弹窗
        modal.style.display = 'block';

        // 触发重排以启动动画
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // 绑定事件
        this.bindQRCodeEvents(url);
    }

    /**
     * 生成二维码
     */
    generateQRCode(text, container) {
        try {
            console.log('开始生成二维码:', text);
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">正在生成二维码...</p>';

            // 检查qrcode-generator库是否加载
            if (typeof qrcode === 'undefined') {
                console.error('qrcode-generator库未加载');
                this.generateQRCodeFallback(text, container);
                return;
            }

            // 使用本地qrcode-generator库生成二维码
            const typeNumber = 0; // 自动检测版本
            const errorCorrectionLevel = 'H'; // 高容错级别
            const qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(text);
            qr.make();

            // 创建二维码显示区域
            const qrContainer = document.createElement('div');
            qrContainer.style.cssText = 'display: inline-block; padding: 16px; background: white; border-radius: 8px; border: 1px solid var(--border-color);';

            const qrSize = 200;
            const cellSize = Math.floor(qrSize / qr.getModuleCount());
            const actualSize = cellSize * qr.getModuleCount();

            // 创建canvas来绘制二维码
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = actualSize;
            canvas.height = actualSize;

            // 绘制二维码
            for (let row = 0; row < qr.getModuleCount(); row++) {
                for (let col = 0; col < qr.getModuleCount(); col++) {
                    ctx.fillStyle = qr.isDark(row, col) ? '#000000' : '#FFFFFF';
                    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                }
            }

            qrContainer.appendChild(canvas);

            container.innerHTML = '';
            container.appendChild(qrContainer);
            console.log('二维码生成成功');

        } catch (error) {
            console.error('生成二维码异常:', error);
            this.generateQRCodeFallback(text, container);
        }
    }

    /**
     * 备用二维码生成方案
     */
    generateQRCodeFallback(text, container) {
        try {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="background: linear-gradient(45deg, #e0e0e0 25%, #ffffff 25%, #ffffff 50%, #e0e0e0 50%, #e0e0e0 75%, #ffffff 75%, #ffffff);
                        background-size: 20px 20px;
                        width: 200px;
                        height: 200px;
                        border: 2px solid #ccc;
                        border-radius: 8px;
                        margin: 0 auto 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        padding: 10px;
                        box-sizing: border-box;
                    ">
                        <div style="font-size: 32px; margin-bottom: 8px;">📱</div>
                        <div style="font-size: 14px; color: #666; text-align: center; line-height: 1.4;">
                            二维码生成失败<br>
                            请手动复制链接
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('备用二维码生成失败:', error);
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">二维码生成失败</p>';
        }
    }

    
    /**
     * 隐藏二维码弹窗
     */
    hideQRCodeModal() {
        const modal = document.getElementById('qrcodeModal');
        modal.classList.remove('show');

        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    /**
     * 绑定二维码弹窗事件
     */
    bindQRCodeEvents(url) {
        // 清除之前的事件监听器
        const closeBtn = document.getElementById('closeQrcodeBtn');
        const overlay = document.querySelector('.qrcode-overlay');
        const copyBtn = document.getElementById('copyLinkBtn');

        // 移除之前的监听器（如果存在）
        closeBtn.onclick = null;
        overlay.onclick = null;
        copyBtn.onclick = null;

        // 关闭按钮
        closeBtn.onclick = () => this.hideQRCodeModal();

        // 点击遮罩层关闭
        overlay.onclick = () => this.hideQRCodeModal();

        // 复制链接按钮
        copyBtn.onclick = (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this.copyToClipboard(url);
        };

        // ESC键关闭（确保只绑定一次）
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.hideQRCodeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.removeEventListener('keydown', handleEscape); // 先移除
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * 复制到剪贴板
     */
    copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                // 使用现代剪贴板API
                navigator.clipboard.writeText(text).catch(() => {
                    this.fallbackCopyToClipboard(text);
                });
            } else {
                // 降级方案
                this.fallbackCopyToClipboard(text);
            }
        } catch (error) {
            console.error('复制失败:', error);
            this.fallbackCopyToClipboard(text);
        }
    }

    /**
     * 降级复制方案
     */
    fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (error) {
            console.error('降级复制失败:', error);
        }
    }

    /**
     * 静默复制到剪贴板（不显示提示）
     */
    copyToClipboardSilent(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).catch(() => {
                    this.fallbackCopyToClipboardSilent(text);
                });
            } else {
                this.fallbackCopyToClipboardSilent(text);
            }
        } catch (error) {
            console.error('静默复制失败:', error);
            this.fallbackCopyToClipboardSilent(text);
        }
    }

    /**
     * 静默降级复制方案
     */
    fallbackCopyToClipboardSilent(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (error) {
            console.error('静默降级复制失败:', error);
        }
    }

    /**
     * 获取默认favicon SVG
     */
    getDefaultFaviconSvg() {
        return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZDEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZjhmOWZhO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNlOWVjZWY7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSIzIiBmaWxsPSJ1cmwoI2dyYWQxKSIgc3Ryb2tlPSIjZGVlMmU2IiBzdHJva2Utd2lkdGg9IjAuNSIvPgogIDxyZWN0IHg9IjIiIHk9IjMiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjODY4ZTk2Ii8+CiAgPHJlY3QgeD0iMiIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEiIHJ4PSIwLjUiIGZpbGw9IiM4NjhlOTYiLz4KICA8cmVjdCB4PSIyIiB5PSI5IiB3aWR0aD0iMTIiIGhlaWdodD0iMSIgcng9IjAuNSIgZmlsbD0iIzg2OGU5NiIvPgogIDxyZWN0IHg9IjIiIHk9IjEyIiB3aWR0aD0iOCIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjODY4ZTk2Ii8+Cjwvc3ZnPg==';
    }

    // ========== 主题与显示设置 ==========

    initTheme() {
        this.applyTheme(this.settings.theme || 'system');

        if (this.themeMediaQuery) {
            const handler = (event) => {
                if (this.settings.theme === 'system') {
                    this.applyTheme('system');
                }
            };

            if (this.themeMediaQuery.addEventListener) {
                this.themeMediaQuery.addEventListener('change', handler);
            } else if (this.themeMediaQuery.addListener) {
                this.themeMediaQuery.addListener(handler);
            }

            this.themeMediaChangeHandler = handler;
        }
    }

    getResolvedTheme(preference) {
        if (preference === 'system') {
            return this.themeMediaQuery && this.themeMediaQuery.matches ? 'dark' : 'light';
        }
        return preference;
    }

    applyTheme(preference = 'system') {
        this.settings.theme = preference;
        const resolvedTheme = this.getResolvedTheme(preference);
        document.documentElement.setAttribute('data-theme', resolvedTheme);
        document.documentElement.setAttribute('data-theme-preference', preference);
        this.updateThemeButton(preference, resolvedTheme);
        this.highlightActiveThemeOption(preference);
    }

    updateThemeButton(preference, resolvedTheme) {
        const toggleBtn = document.getElementById('themeToggleBtn');
        if (!toggleBtn) return;
        toggleBtn.dataset.themePreference = preference;
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.toggle('dark-active', resolvedTheme === 'dark');
    }

    highlightActiveThemeOption(preference) {
        const themeRadios = document.querySelectorAll('input[name="themePreference"]');
        themeRadios.forEach(radio => {
            radio.checked = radio.value === preference;
        });
    }

    // ========== 国际化支持 ==========

    /**
     * 检测系统语言
     */
    detectLanguage() {
        // 获取浏览器语言
        const browserLang = navigator.language || navigator.userLanguage;

        // 更严格的中文检测 - 只有明确是中文环境才使用中文
        // 检查常见的中文语言代码
        const chineseLangCodes = ['zh-CN', 'zh-SG', 'zh-MO', 'zh-HK', 'zh-TW'];

        // 只有当浏览器语言明确是中文时才返回中文
        if (chineseLangCodes.includes(browserLang)) {
            return 'zh-CN';
        }

        // 对于 zh 这种模糊的匹配，需要进一步检查
        if (browserLang.startsWith('zh')) {
            // 检查用户的首选语言列表
            const languages = navigator.languages || [browserLang];

            // 如果用户的语言偏好中英文排在前面，则使用英文
            const hasEnglishFirst = languages.some((lang, index) => {
                return index < 2 && (lang.startsWith('en') || lang === 'en');
            });

            if (hasEnglishFirst) {
                return 'en';
            }

            return 'zh-CN';
        }

        // 默认返回英文
        return 'en';
    }

    /**
     * 获取翻译文本
     */
    t(key, params = {}) {
        if (typeof t === 'function') {
            // 如果全局t函数存在（从i18n.js加载），使用它
            return t(key, params);
        }

        // 否则使用内置的基本翻译
        const basicTranslations = {
            'zh-CN': {
                'bookmarks_bar': 'Bookmarks Bar',
                'other_bookmarks': 'Other Bookmarks',
                'all_bookmarks': '全部书签',
                'pinned': '置顶',
                'search_bookmarks': '搜索书签...',
                'search_on_google': '在 Google 中搜索...',
                'search_on_bing': '在 Bing 中搜索...',
                'search_on_baidu': '在百度中搜索...',
                'no_bookmarks': '暂无书签',
                'unnamed_folder': '未命名文件夹',
                'appearance': '外观',
                'appearance_desc': '选择偏好的配色模式',
                'theme_light': '浅色',
                'theme_dark': '深色',
                'theme_system': '跟随系统',
                'theme_light_desc': '明亮清爽的界面风格',
                'theme_dark_desc': '夜间友好的暗色主题',
                'theme_system_desc': '根据系统外观自动切换'
            },
            'en': {
                'bookmarks_bar': 'Bookmarks Bar',
                'other_bookmarks': 'Other Bookmarks',
                'all_bookmarks': 'All Bookmarks',
                'pinned': 'Pinned',
                'search_bookmarks': 'Search bookmarks...',
                'search_on_google': 'Search on Google...',
                'search_on_bing': 'Search on Bing...',
                'search_on_baidu': 'Search on Baidu...',
                'no_bookmarks': 'No Bookmarks',
                'unnamed_folder': 'Unnamed Folder',
                'appearance': 'Appearance',
                'appearance_desc': 'Choose the visual style you prefer',
                'theme_light': 'Light',
                'theme_dark': 'Dark',
                'theme_system': 'System',
                'theme_light_desc': 'Bright and clean interface',
                'theme_dark_desc': 'Eye-friendly dark experience',
                'theme_system_desc': 'Follow OS preference automatically'
            }
        };

        const translations = basicTranslations[this.currentLanguage] || basicTranslations['en'];
        let text = translations[key] || key;

        // 替换参数占位符
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });

        return text;
    }

    /**
     * 初始化界面文本
     */
    initializeUIText() {
        // 更新所有带 data-i18n 属性的元素
        this.updateI18nElements();

        // 更新主界面文本
        this.updateMainUIText();

        // 更新按钮提示文本
        this.updateButtonTitles();

        // 更新设置界面文本
        this.updateSettingsUIText();
    }

    /**
     * 更新所有带 data-i18n 属性的元素
     */
    updateI18nElements() {
        try {
            const textElements = document.querySelectorAll('[data-i18n]');
            textElements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (key && !element.hasAttribute('data-i18n-skip')) {
                    element.textContent = t(key);
                }
            });

            const elements = document.querySelectorAll('*');
            elements.forEach(element => {
                Array.from(element.attributes).forEach(attr => {
                    if (attr.name.startsWith('data-i18n-') && attr.name !== 'data-i18n') {
                        const targetAttr = attr.name.replace('data-i18n-', '');
                        const messageKey = attr.value;
                        if (messageKey) {
                            this.applyI18nAttribute(element, targetAttr, messageKey);
                        }
                    }
                });
            });
        } catch (error) {
            console.error('updateI18nElements 执行失败:', error);
        }
    }

    /**
     * 将翻译写入指定属性
     */
    applyI18nAttribute(element, attributeName, key) {
        if (!element || !attributeName || !key) {
            return;
        }

        const message = t(key);
        if (!message) {
            return;
        }

        if (attributeName === 'html') {
            element.innerHTML = message;
        } else if (attributeName === 'text') {
            element.textContent = message;
        } else {
            element.setAttribute(attributeName, message);
        }
    }

    /**
     * 更新主界面文本
     */
    updateMainUIText() {
        // 更新搜索框占位符
        this.updateSearchPlaceholder();

        // 更新导航标签
        const bookmarksBarTab = document.getElementById('bookmarksBarTab');
        const otherBookmarksTab = document.getElementById('otherBookmarksTab');

        if (bookmarksBarTab) {
            const span = bookmarksBarTab.querySelector('span');
            if (span) span.textContent = t('bookmarks_bar');
        }

        if (otherBookmarksTab) {
            const span = otherBookmarksTab.querySelector('span');
            if (span) span.textContent = t('other_bookmarks');
        }

        this.updateMobileBreadcrumb();
    }

    /**
     * 根据manifest版本更新关于页面版本号
     */
    updateVersionInfo() {
        try {
            const versionElement = document.querySelector('[data-i18n="app_version"]');
            if (!versionElement) {
                return;
            }

            const manifest = chrome.runtime && typeof chrome.runtime.getManifest === 'function'
                ? chrome.runtime.getManifest()
                : null;
            const manifestVersion = manifest && manifest.version ? manifest.version : '';

            const localizedText = t('app_version', manifestVersion);
            const fallbackText = `Version ${manifestVersion || ''}`;
            versionElement.textContent = localizedText || fallbackText;
        } catch (error) {
            console.error('更新版本号失败:', error);
        }
    }

    /**
     * 更新按钮提示文本
     */
    updateButtonTitles() {
        try {
            const buttons = [
            { id: 'downloadBtn', title: t('download') },
            { id: 'historyBtn', title: t('history') },
            { id: 'bookmarksBtn', title: t('bookmarks_manager') },
            { id: 'extensionsBtn', title: t('extensions') },
            { id: 'settingsBtn', title: t('settings') },
            { id: 'clearSearch', title: t('clear_search') }
        ];

        buttons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                element.setAttribute('title', btn.title);
            }
        });
        } catch (error) {
            console.error('updateButtonTitles 执行失败:', error);
        }
    }

    /**
     * 更新设置界面文本
     */
    updateSettingsUIText() {
        // 这里在设置面板打开时会被调用
        // 具体实现在openSettingsModal方法中
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MarkLauncher();
});
