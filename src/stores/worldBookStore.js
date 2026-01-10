import { defineStore } from 'pinia'
import localforage from 'localforage'

export const useWorldBookStore = defineStore('worldBook', {
    state: () => ({
        // Structure: [{ id, name, description, entries: [{ id, name, keys: [], content: '' }] }]
        books: []
    }),

    actions: {
        async loadEntries() {
            const data = await localforage.getItem('wechat_worldbook_books')
            if (data) {
                this.books = data
            } else {
                // Init empty
                this.books = []
                this.saveEntries()
            }
        },

        async saveEntries() {
            await localforage.setItem('wechat_worldbook_books', JSON.parse(JSON.stringify(this.books)))
        },

        // --- Book Actions ---
        createBook(name, description = '') {
            const newBook = {
                id: 'book_' + Date.now(),
                name,
                description,
                entries: [] // Entries inside this book
            }
            this.books.push(newBook)
            this.saveEntries()
            return newBook
        },

        updateBook(id, updates) {
            const idx = this.books.findIndex(b => b.id === id)
            if (idx !== -1) {
                this.books[idx] = { ...this.books[idx], ...updates }
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

        updateEntry(bookId, entryId, updates) {
            const book = this.books.find(b => b.id === bookId)
            if (book) {
                const idx = book.entries.findIndex(e => e.id === entryId)
                if (idx !== -1) {
                    book.entries[idx] = { ...book.entries[idx], ...updates }
                    this.saveEntries()
                }
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
        }
    }
})
