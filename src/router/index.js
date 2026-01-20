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
            path: '/wechat/moments',
            name: 'moments',
            component: () => import('../views/WeChat/MomentsView.vue'),
            props: route => ({ initialProfileId: route.query.author })
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
            path: '/weibo',
            name: 'weibo',
            component: () => import('../views/WeiboApp.vue')
        },
        {
            path: '/wechat/profile/:charId',
            name: 'character-info',
            component: () => import('../views/WeChat/CharacterProfileView.vue')
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
        {
            path: '/gallery',
            name: 'gallery',
            component: () => import('../views/WeChat/GalleryView.vue')
        },
        {
            path: '/wechat/moments/detail/:id',
            name: 'moment-detail',
            component: () => import('../views/WeChat/MomentDetailView.vue')
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
            path: '/wallet/bank-cards/:id',
            name: 'wallet-bank-card-detail',
            component: () => import('../views/Wallet/WalletBankCardDetail.vue')
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
        },
        {
            path: '/wallet/bill/statistics',
            name: 'wallet-bill-statistics',
            component: () => import('../views/Wallet/WalletStatisticsView.vue')
        }
    ]
})

// --- Error Handling & Deployment Awareness ---
// If we deploy a new version, old asset hashes change. 
// When a user tries to click a new page, the browser fails to fetch the old .js file (ChunkLoadError).
// This logic force-refreshes the page to the new version instead of letting the UI "freeze".
router.onError((error, to) => {
    if (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk')) {
        console.warn('[Router] Deployment change detected. Force refreshing to load new assets...', error);
        window.location.reload();
    }
});

// --- UI Anti-Stall Guard ---
// Ensure that when returning to Home (/), we clear any blocking states
router.afterEach((to) => {
    if (to.path === '/') {
        // Force scroll to top
        window.scrollTo(0, 0);
        // Dispatch a global event to let components (like WeChat) know we are back at desktop
        window.dispatchEvent(new CustomEvent('app-returned-to-desktop'));
    }
});

export default router
