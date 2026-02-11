<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'
import { marked } from 'marked'
import SafeHtmlCard from '../../components/SafeHtmlCard.vue'

const route = useRoute()
const router = useRouter()
const favoritesStore = useFavoritesStore()
const chatStore = useChatStore()
const stickerStore = useStickerStore()

const itemId = computed(() => route.params.id)
const item = computed(() => {
    const id = itemId.value ? String(itemId.value) : null
    if (!id) return null

    const fromStore = favoritesStore.favorites.find(f => String(f.id) === id)
    if (fromStore) return fromStore

    return null
})

const forceDelete = () => {
    chatStore.triggerConfirm('强制删除', '是否强制删除该无效记录?', () => {
        favoritesStore.removeFavorite(itemId.value)
        router.back()
    })
}

const allStickers = computed(() => {
    const global = stickerStore.stickers || []
    const charStickers = Object.values(chatStore.chats).flatMap(c => c.emojis || [])
    return [...global, ...charStickers]
})

const specialContent = computed(() => {
    if (!item.value) return null
    if (item.value.type === 'chat_record') return null
    if (item.value.type !== 'text' && item.value.type !== 'sticker' && item.value.type !== 'single') return null

    const content = item.value.content || ''

    if (item.value.type === 'html' || content.startsWith('[CARD]') || (content.trim().startsWith('{') && content.includes('"type"'))) {
        try {
            let jsonStr = content;
            if (content.startsWith('[CARD]')) {
