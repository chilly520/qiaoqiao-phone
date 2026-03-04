import { defineStore } from 'pinia'
import localforage from 'localforage'

export const useWorldBookStore = defineStore('worldBook', {
    state: () => ({
        // Structure: [{ id, name, description, entries: [{ id, name, keys: [], content: '' }] }]
        books: []
    }),

    actions: {
        async loadEntries() {
            try {
                // safeguard: if already loaded, don't reload
                if (this.books && this.books.length > 0) return;

                // 1. Try localforage
                const data = await localforage.getItem('wechat_worldbook_books')
                if (data && Array.isArray(data) && data.length > 0) {
                    this.books = data
                    console.log('[WorldBook] Loaded from localForage:', data.length)
                } else {
                    // 2. MIGRATION: Check legacy localStorage
                    const legacy = localStorage.getItem('wechat_worldbook_books')
                    if (legacy) {
                        try {
                            const parsed = JSON.parse(legacy)
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                console.log('[WorldBook] Migrating legacy data:', parsed.length)
                                this.books = parsed
                                return
                            }
                        } catch (e) { console.error('[WorldBook] Legacy migration failed', e) }
                    }
                    this.books = []
                }
            } catch (e) {
                console.error('[WorldBook] Load error', e)
                this.books = []
            }
        },

        async saveEntries() {
            try {
                const dataToSave = JSON.parse(JSON.stringify(this.books))
                await localforage.setItem('wechat_worldbook_books', dataToSave)
            } catch (e) { console.error('[WorldBook] Save failed', e) }
        },

        // --- Book Actions ---
        // Aligned with WorldBookApp.vue expectations
        addBook(bookData) {
            const newBook = {
                id: 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: bookData.name || '未命名世界书',
                description: bookData.description || '',
                entries: []
            }
            this.books.push(newBook)
            this.saveEntries()
            return newBook
        },

        // Kept for backward compatibility
        createBook(name, description = '') {
            return this.addBook({ name, description })
        },

        updateBook(idOrData, maybeUpdates) {
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
                // Ensure we don't clobber entries
                const oldEntries = this.books[idx].entries
                this.books[idx] = { ...this.books[idx], ...updates }
                if (!updates.entries) this.books[idx].entries = oldEntries
                this.saveEntries()
            }
        },

        deleteBook(id) {
            const idx = this.books.findIndex(b => b.id === id)
            if (idx !== -1) {
                this.books.splice(idx, 1)
                this.saveEntries()
            }
        },

        getBookById(id) {
            return this.books.find(b => b.id === id)
        },

        // --- Entry Actions ---
        addEntry(bookId, entry) {
            const book = this.books.find(b => b.id === bookId)
            if (book) {
                if (!entry.id) entry.id = 'wb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                book.entries.push(entry)
                this.saveEntries()
                return entry
            }
        },

        updateEntry(bookId, entryIdOrObj, maybeUpdates) {
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
                book.entries[idx] = { ...book.entries[idx], ...updates }
                this.saveEntries()
            }
        },

        deleteEntry(bookId, entryId) {
            const book = this.books.find(b => b.id === bookId)
            if (book) {
                const idx = book.entries.findIndex(e => e.id === entryId)
                if (idx !== -1) {
                    book.entries.splice(idx, 1)
                    this.saveEntries()
                }
            }
        },

        async importBook(data) {
            if (!data || !data.name) {
                throw new Error('无效的世界书格式：缺少名称')
            }

            // Generate new ID to avoid conflict
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
