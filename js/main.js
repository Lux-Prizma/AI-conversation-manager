/**
 * Main Application - Orchestrates all modules
 */

import { eventBus } from './core/EventBus.js';
import { MessageRenderer } from './features/MessageRenderer.js';
// Note: Other features will be imported as they're created

class ChatGPTParserApp {
    constructor() {
        this.data = chatData; // Global data instance from data.js
        this.currentView = 'upload';
        this.searchResults = [];
        this.currentSort = 'newestCreated';
        this.highlightedPairId = null;

        // Date filter state
        this.dateFilter = {
            active: false,
            type: 'createTime',
            startDate: null,
            endDate: null
        };

        // Question navigation state
        this.currentPairs = [];
        this.currentQuestionIndex = -1;

        // Initialize features
        this.messageRenderer = new MessageRenderer(eventBus, this.data);

        this.init();
    }

    init() {
        this.bindEvents();
        this.initAsync();
    }

    async initAsync() {
        await this.data.loadFromStorage();
        this.currentSort = this.data.currentSort || 'newestCreated';
        document.getElementById('sortSelect').value = this.currentSort;
        this.updateUI();
    }

    bindEvents() {
        // Top navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.openTab(tabName, tab);
            });
        });

        // File upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        document.getElementById('newChatBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        // Sort control
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.updateConversationList();
        });

        // Filter button
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.showDateFilterDialog();
        });

        // Folder headers
        document.querySelectorAll('.folder-header[data-folder]').forEach(header => {
            header.addEventListener('click', (e) => {
                const folderId = header.dataset.folder;
                this.toggleFolder(folderId);
            });
        });

        // Global search
        document.getElementById('globalSearchInput').addEventListener('input', (e) => {
            this.handleGlobalSearch(e.target.value);
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Edit thread title
        document.getElementById('editTitleBtn').addEventListener('click', () => {
            this.toggleTitleEdit();
        });

        document.getElementById('threadTitleInput').addEventListener('blur', () => {
            this.saveTitleEdit();
        });

        document.getElementById('threadTitleInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTitleEdit();
            }
        });

        // Delete thread
        document.getElementById('deleteThreadBtn').addEventListener('click', () => {
            this.deleteCurrentThread();
        });

        // Thread search
        document.getElementById('threadSearchInput').addEventListener('input', (e) => {
            eventBus.emit('search:query', { query: e.target.value });
        });

        document.getElementById('searchNextBtn').addEventListener('click', () => {
            eventBus.emit('search:next');
        });

        document.getElementById('searchPrevBtn').addEventListener('click', () => {
            eventBus.emit('search:prev');
        });

        document.getElementById('searchCloseBtn').addEventListener('click', () => {
            eventBus.emit('search:clear');
        });

        // Save project
        document.getElementById('saveProjectBtn').addEventListener('click', () => {
            this.saveProject();
        });

        // Clear data
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                this.clearAllData();
            }
        });

        // New Folder button
        document.getElementById('newFolderBtn').addEventListener('click', () => {
            this.showNewFolderDialog();
        });

        // Setup event bus listeners
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        eventBus.on('pair:delete', async (data) => {
            if (this.data.currentConversationId && confirm('Delete this message pair? This cannot be undone.')) {
                await this.data.deletePair(this.data.currentConversationId, data.pairId);
                this.updateMainView();
            }
        });

        eventBus.on('pair:star', async (data) => {
            if (this.data.currentConversationId) {
                await this.data.toggleStarPair(this.data.currentConversationId, data.pairId);
                this.updateMainView();
            }
        });
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const totalConversations = [];
        const allWarnings = [];

        for (const file of files) {
            try {
                const content = await file.text();
                let conversations = [];
                let warnings = [];

                if (file.name.endsWith('.json')) {
                    const jsonData = JSON.parse(content);
                    const result = this.data.parseJSONExport(jsonData);
                    conversations = result.conversations;
                    warnings = result.warnings;
                } else if (file.name.endsWith('.html')) {
                    conversations = this.data.parseHTMLExport(content);
                }

                totalConversations.push(...conversations);
                allWarnings.push(...warnings);
            } catch (error) {
                console.error('Error parsing file', file.name, ':', error);
                alert(`Error parsing file: ${file.name}\n\n${error.message}`);
            }
        }

        if (allWarnings.length > 0) {
            console.warn('Import warnings:', allWarnings);
        }

        if (totalConversations.length > 0) {
            await this.data.addConversations(totalConversations);
            alert(`Successfully imported ${totalConversations.length} conversation(s)!`);
            this.updateUI();
        } else {
            alert('No valid conversations found in the uploaded file(s).');
        }

        document.getElementById('fileInput').value = '';
    }

    toggleFolder(folderId) {
        const folder = document.querySelector(`.folder-header[data-folder="${folderId}"]`);
        const content = document.getElementById(`${folderId}Content`);
        const arrow = folder.querySelector('.folder-arrow');

        if (!folder || !content || !arrow) return;

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            arrow.classList.remove('collapsed');
        } else {
            content.classList.add('collapsed');
            arrow.classList.add('collapsed');
        }
    }

    handleGlobalSearch(query) {
        this.updateConversationList();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    toggleTitleEdit() {
        const input = document.getElementById('threadTitleInput');
        input.disabled = !input.disabled;
        if (!input.disabled) {
            input.focus();
            input.select();
        }
    }

    async saveTitleEdit() {
        const input = document.getElementById('threadTitleInput');
        input.disabled = true;

        if (this.data.currentConversationId) {
            const newTitle = input.value.trim();
            if (newTitle) {
                await this.data.updateConversationTitle(this.data.currentConversationId, newTitle);
                this.updateConversationList();
            }
        }
    }

    async deleteCurrentThread() {
        if (!this.data.currentConversationId) return;

        if (confirm('Are you sure you want to delete this entire conversation? This cannot be undone.')) {
            await this.data.deleteConversation(this.data.currentConversationId);
            this.updateUI();
        }
    }

    saveProject() {
        const project = this.data.exportProject();
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chatgpt-parser-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async clearAllData() {
        await this.data.clearStorage();
        this.data.conversations = [];
        this.data.currentConversationId = null;
        this.updateUI();
    }

    updateUI() {
        this.updateConversationList();
        this.updateMainView();
    }

    sortConversations(conversations) {
        const sorted = [...conversations];

        switch (this.currentSort) {
            case 'newestCreated':
                sorted.sort((a, b) => b.createTime - a.createTime);
                break;
            case 'oldestCreated':
                sorted.sort((a, b) => a.createTime - b.createTime);
                break;
            case 'recentlyUpdated':
                sorted.sort((a, b) => b.updateTime - a.updateTime);
                break;
            case 'alphabetical':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }

        return sorted;
    }

    updateConversationList() {
        // This will be extracted to ConversationList feature
        // For now, keep simplified version
        let allConversations = this.data.conversations;
        const starredConversations = allConversations.filter(conv => conv.starred);
        const allStarredPairs = this.data.getStarredPairs();

        const searchQuery = document.getElementById('globalSearchInput').value.trim();

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            allConversations = allConversations.filter(conv => {
                if (conv.title.toLowerCase().includes(lowerQuery)) {
                    return true;
                }
                return conv.pairs.some(pair =>
                    pair.question.content.toLowerCase().includes(lowerQuery) ||
                    pair.answers.some(ans => ans.content.toLowerCase().includes(lowerQuery))
                );
            });
        }

        const sortedAll = this.sortConversations(allConversations);
        const sortedStarred = this.sortConversations(starredConversations);

        document.querySelector('#allConversationsFolder .folder-count').textContent = `(${sortedAll.length})`;
        document.querySelector('#starredConversationsFolder .folder-count').textContent = `(${sortedStarred.length})`;
        document.querySelector('#starredPairsFolder .folder-count').textContent = `(${allStarredPairs.length})`;

        this.renderConversationFolder(document.getElementById('allConversationsContent'), sortedAll);
        this.renderConversationFolder(document.getElementById('starredConversationsContent'), sortedStarred);
        this.renderStarredPairsFolder(document.getElementById('starredPairsContent'), allStarredPairs);
    }

    renderConversationFolder(container, conversations) {
        container.innerHTML = '';

        if (conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No conversations</p>
                    <small>Import your ChatGPT export to get started</small>
                </div>
            `;
            return;
        }

        conversations.forEach(conv => {
            const item = this.createConversationItem(conv);
            container.appendChild(item);
        });
    }

    renderStarredPairsFolder(container, starredPairs) {
        container.innerHTML = '';

        if (starredPairs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No starred pairs yet</p>
                    <small>Star pairs to see them here</small>
                </div>
            `;
            return;
        }

        starredPairs.forEach((pair) => {
            const item = this.createStarredPairItem(pair);
            container.appendChild(item);
        });
    }

    createConversationItem(conv) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.id = conv.id;

        if (this.data.currentConversationId === conv.id) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <div class="conversation-item-title" title="${conv.title}">
                ${conv.title}
            </div>
            <span class="star-icon ${conv.starred ? 'starred' : ''}" data-id="${conv.id}">
                ${conv.starred ? '⭐' : '☆'}
            </span>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('star-icon')) {
                this.selectConversation(conv.id);
            }
        });

        const starIcon = item.querySelector('.star-icon');
        starIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStarConversation(conv.id);
        });

        return item;
    }

    createStarredPairItem(pair) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.pairId = pair.id;
        item.dataset.conversationId = pair.conversationId;

        const previewText = pair.question.content.substring(0, 50);
        const truncatedText = previewText.length < pair.question.content.length
            ? previewText + '...'
            : previewText;

        item.innerHTML = `
            <span class="star-icon starred">💎</span>
            <div class="conversation-item-title" title="${pair.question.content}">
                ${truncatedText}
            </div>
            <small style="color: var(--text-muted);">from "${pair.conversationTitle}"</small>
        `;

        item.addEventListener('click', () => {
            this.selectConversationWithHighlightedPair(pair.conversationId, pair.id);
        });

        return item;
    }

    async selectConversation(id) {
        this.data.currentConversationId = id;
        await this.data.saveToStorage();
        this.updateUI();
        eventBus.emit('search:clear');

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    selectConversationWithHighlightedPair(conversationId, pairId) {
        this.data.currentConversationId = conversationId;
        this.highlightedPairId = pairId;
        this.messageRenderer.highlightedPairId = pairId;
        this.updateUI();
        eventBus.emit('search:clear');

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    async toggleStarConversation(id) {
        await this.data.toggleStarConversation(id);
        this.updateConversationList();
    }

    updateMainView() {
        const uploadState = document.getElementById('uploadState');
        const chatView = document.getElementById('chatView');

        if (!this.data.currentConversationId) {
            uploadState.style.display = 'flex';
            chatView.style.display = 'none';
            this.currentView = 'upload';
            return;
        }

        uploadState.style.display = 'none';
        chatView.style.display = 'flex';
        this.currentView = 'chat';

        const conv = this.data.getCurrentConversation();
        if (conv) {
            document.getElementById('threadTitleInput').value = conv.title;
            this.currentPairs = conv.pairs;
            this.messageRenderer.highlightedPairId = this.highlightedPairId;
            this.messageRenderer.renderPairs(conv.pairs);

            // Scroll to highlighted pair if set
            if (this.highlightedPairId) {
                const scrollToPair = (attempt = 0) => {
                    const highlightedPair = document.querySelector(`.pair-container[data-pair-id="${this.highlightedPairId}"]`);
                    if (highlightedPair) {
                        highlightedPair.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        this.highlightedPairId = null;
                        this.messageRenderer.highlightedPairId = null;
                    } else if (attempt < 10) {
                        setTimeout(() => scrollToPair(attempt + 1), 100);
                    } else {
                        this.highlightedPairId = null;
                        this.messageRenderer.highlightedPairId = null;
                    }
                };
                setTimeout(() => scrollToPair(), 200);
            }
        }
    }

    openTab(tabName, tabElement) {
        this.closeTabPanel();
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        if (tabElement) {
            tabElement.classList.add('active');
        }

        const panel = document.getElementById(`${tabName}-panel`);
        if (panel) {
            panel.style.display = 'flex';
        }
    }

    closeTabPanel() {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.style.display = 'none';
        });
    }

    showNewFolderDialog() {
        document.getElementById('newFolderDialog').style.display = 'flex';
    }

    showDateFilterDialog() {
        document.getElementById('dateFilterDialog').style.display = 'flex';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatGPTParserApp();
});
