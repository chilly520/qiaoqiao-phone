import { defineStore } from 'pinia'
import localforage from 'localforage'

export const useWorldBookStore = defineStore('worldBook', {
    state: () => ({
        // Structure: [{ id, name, description, entries: [{ id, name, keys: [], content: '' }] }]
        books: [],
        isLoaded: false,
        loadingPromise: null
    }),

    actions: {
        async loadEntries() {
            // Return existing promise if already loading
            if (this.loadingPromise) return this.loadingPromise;
            
            // If already loaded, return resolved
            if (this.isLoaded) return Promise.resolve();

            this.loadingPromise = (async () => {
                const timeout = setTimeout(() => {
                    if (this.loadingPromise) {
                        console.error('[WorldBook] Load timed out');
                        this.loadingPromise = null;
                        // We DON'T set isLoaded = true on timeout to prevent unsafe save
                    }
                }, 5000);

                try {
                    // 1. Try localforage
                    const data = await localforage.getItem('wechat_worldbook_books')
                    clearTimeout(timeout)
                    
                    if (data && Array.isArray(data)) {
                        this.books = data
                        console.log('[WorldBook] Loaded from localForage:', data.length)
                    } else {
                        // 2. MIGRATION: Check legacy localStorage
                        const legacy = localStorage.getItem('wechat_worldbook_books')
                        if (legacy) {
                            try {
                                const parsed = JSON.parse(legacy)
                                if (Array.isArray(parsed)) {
                                    console.log('[WorldBook] Migrating legacy data:', parsed.length)
                                    this.books = parsed
                                    await localforage.setItem('wechat_worldbook_books', parsed)
                                }
                            } catch (e) { console.error('[WorldBook] Legacy migration failed', e) }
                        }
                    }
                    this.isLoaded = true
                } catch (e) {
                    clearTimeout(timeout)
                    console.error('[WorldBook] Load error', e)
                    // CRITICAL: Do NOT set isLoaded = true here. 
                    // This prevents saveEntries from wiping the disk if loading failed.
                } finally {
                    this.loadingPromise = null;
                }
            })();

            return this.loadingPromise;
        },

        async saveEntries() {
            // Wait for load to finish if it's in progress
            if (this.loadingPromise) await this.loadingPromise;
            
            if (!this.isLoaded) {
                // If still not loaded (load error?), we MUST NOT SAVE
                // otherwise we might wipe existing data with [].
                console.warn('[WorldBook] Save aborted: Store not in a safe state to save')
                return
            }
            
            try {
                // Deep clone to avoid reactivity issues with localforage
                const dataToSave = JSON.parse(JSON.stringify(this.books))
                await localforage.setItem('wechat_worldbook_books', dataToSave)
                // Also trigger a storage event for multi-tab sync if needed
                localStorage.setItem('wechat_worldbook_last_save', Date.now().toString());
            } catch (e) { console.error('[WorldBook] Save failed', e) }
        },

        // Ensure store is ready before any modification
        async ensureLoaded() {
            if (this.isLoaded) return;
            if (this.loadingPromise) return this.loadingPromise;
            return this.loadEntries();
        },

        // Helper to normalize keys to an array
        _normalizeKeys(keys) {
            if (!keys) return [];
            if (Array.isArray(keys)) return keys.filter(k => k && k.trim());
            if (typeof keys === 'string') {
                return keys.split(/[\s,，]+/).filter(k => k && k.trim());
            }
            return [];
        },

        // --- Book Actions ---
        async addBook(bookData) {
            await this.ensureLoaded()
            const newBook = {
                id: 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: bookData.name || '未命名世界书',
                description: bookData.description || '',
                entries: []
            }
            this.books.push(newBook)
            await this.saveEntries()
            return newBook
        },

        async createBook(name, description = '') {
            return this.addBook({ name, description })
        },

        async updateBook(idOrData, maybeUpdates) {
            await this.ensureLoaded()
            let id, updates;
            if (typeof idOrData === 'object' && idOrData.id) {
                id = idOrData.id
                updates = idOrData
            } else {
                id = idOrData
                updates = maybeUpdates
            }

            const idx = this.books.findIndex(b => b.id === id)
            if (idx !== -1 && updates) {
                const oldEntries = this.books[idx].entries
                this.books[idx] = { ...this.books[idx], ...updates }
                if (!updates.entries) this.books[idx].entries = oldEntries
                await this.saveEntries()
            }
        },

        async deleteBook(id) {
            await this.ensureLoaded()
            const idx = this.books.findIndex(b => b.id === id)
            if (idx !== -1) {
                this.books.splice(idx, 1)
                await this.saveEntries()
            }
        },

        getBookById(id) {
            // Note: get actions stay sync but might return null if not loaded yet
            return this.books.find(b => b.id === id)
        },

        // --- Entry Actions ---
        async addEntry(bookId, entry) {
            await this.ensureLoaded()
            const book = this.books.find(b => b.id === bookId)
            if (book) {
                if (!entry.id) entry.id = 'wb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                
                // Normalize keys
                const normalizedEntry = {
                    ...entry,
                    keys: this._normalizeKeys(entry.keys)
                }
                
                book.entries.push(normalizedEntry)
                await this.saveEntries()
                return normalizedEntry
            }
        },

        async updateEntry(bookId, entryIdOrObj, maybeUpdates) {
            await this.ensureLoaded()
            const book = this.books.find(b => b.id === bookId)
            if (!book) return;

            let entryId, updates;
            if (typeof entryIdOrObj === 'object' && entryIdOrObj.id) {
                entryId = entryIdOrObj.id
                updates = entryIdOrObj
            } else {
                entryId = entryIdOrObj
                updates = maybeUpdates
            }

            const idx = book.entries.findIndex(e => e.id === entryId)
            if (idx !== -1 && updates) {
                // Normalize keys if they were provided in updates
                const finalUpdates = { ...updates }
                if ('keys' in finalUpdates) {
                    finalUpdates.keys = this._normalizeKeys(finalUpdates.keys)
                }
                
                book.entries[idx] = { ...book.entries[idx], ...finalUpdates }
                await this.saveEntries()
            }
        },

        async deleteEntry(bookId, entryId) {
            await this.ensureLoaded()
            const book = this.books.find(b => b.id === bookId)
            if (book) {
                const idx = book.entries.findIndex(e => e.id === entryId)
                if (idx !== -1) {
                    book.entries.splice(idx, 1)
                    await this.saveEntries()
                }
            }
        },

        async importBook(data) {
            await this.ensureLoaded()
            if (!data || !data.name) {
                throw new Error('无效的世界书格式：缺少名称')
            }

            const newBook = {
                ...data,
                id: 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                entries: Array.isArray(data.entries) ? data.entries : []
            }

            this.books.push(newBook)
            await this.saveEntries()
            return newBook
        }
    }
})
