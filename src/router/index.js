import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView
        },
        {
            path: '/wechat',
            name: 'wechat',
            component: () => import('../views/WeChat/WeChatApp.vue')
        },
        {
            path: '/settings',
            name: 'settings',
            component: () => import('../views/Settings/SettingsHome.vue')
        },
        {
            path: '/settings/api',
            name: 'settings-api',
            component: () => import('../views/Settings/APISettings.vue')
        },
        {
            path: '/settings/personalization',
            name: 'settings-personalization',
            component: () => import('../views/Settings/PersonalizationSettings.vue')
        },
        {
            path: '/settings/voice',
            name: 'settings-voice',
            component: () => import('../views/Settings/VoiceSettings.vue')
        },
        {
            path: '/settings/weather',
            name: 'settings-weather',
            component: () => import('../views/Settings/WeatherSettings.vue')
        },
        {
            path: '/settings/storage',
            name: 'settings-storage',
            component: () => import('../views/Settings/StorageSettings.vue')
        },
        {
            path: '/settings/data',
            name: 'settings-data',
            component: () => import('../views/Settings/DataSettings.vue')
        },
        {
            path: '/settings/drawing',
            name: 'settings-drawing',
            component: () => import('../views/Settings/DrawingSettings.vue')
        },
        {
            path: '/settings/backup',
            name: 'settings-backup',
            component: () => import('../views/Settings/BackupSettings.vue')
        },
        {
            path: '/system-logs',
            name: 'system-logs',
            component: () => import('../views/System/SystemLogs.vue')
        },
        {
            path: '/worldbook',
            name: 'worldbook',
            component: () => import('../views/WorldBook/WorldBookApp.vue')
        },
        {
            path: '/wechat/profile/:charId',
            name: 'character-info',
            component: () => import('../views/WeChat/CharacterInfoCard.vue')
        },
        {
            path: '/moments/profile/:charId',
            name: 'character-profile',
            component: () => import('../views/WeChat/CharacterProfileView.vue')
        },
        {
            path: '/favorites',
            name: 'favorites',
            component: () => import('../views/WeChat/FavoritesView.vue')
        },
        {
            path: '/favorites/:id',
            name: 'favorite-detail',
            component: () => import('../views/WeChat/FavoriteDetailView.vue')
        },
        // Wallet Routes
        {
            path: '/wallet',
            name: 'wallet',
            component: () => import('../views/Wallet/WalletHome.vue')
        },
        {
            path: '/wallet/bill',
            name: 'wallet-bill',
            component: () => import('../views/Wallet/WalletBillView.vue')
        },
        {
            path: '/wallet/bank-cards',
            name: 'wallet-bank-cards',
            component: () => import('../views/Wallet/WalletBankCardsView.vue')
        },
        {
            path: '/wallet/family-cards',
            name: 'wallet-family-cards',
            component: () => import('../views/Wallet/WalletFamilyCardsView.vue')
        },
        {
            path: '/wallet/family-cards/:id',
            name: 'wallet-family-card-detail',
            component: () => import('../views/Wallet/WalletFamilyCardDetail.vue')
        }
    ]
})

export default router
