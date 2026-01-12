/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // 软萌可爱色板 🌸
            colors: {
                'kawaii-pink': {
                    50: '#fff0f6',
                    100: '#ffe0ee',
                    200: '#ffc1dd',
                    300: '#ff92c2',
                    400: '#ff5ca7',
                    500: '#ff2d8c',
                    600: '#f7086e',
                    700: '#d10054',
                    800: '#ad0047',
                    900: '#8f003d',
                },
                'kawaii-purple': {
                    50: '#faf5ff',
                    100: '#f3e8ff',
                    200: '#e9d5ff',
                    300: '#d8b4fe',
                    400: '#c084fc',
                    500: '#a855f7',
                    600: '#9333ea',
                    700: '#7e22ce',
                    800: '#6b21a8',
                    900: '#581c87',
                },
                'kawaii-blue': {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                'kawaii-cream': '#fffbf0',
                'kawaii-peach': '#ffd4d4',
                'kawaii-lavender': '#e6e6fa',
                'kawaii-mint': '#d4f5f0',
            },
            // 更大的圆角
            borderRadius: {
                'kawaii': '1.5rem',
                'kawaii-lg': '2rem',
                'kawaii-xl': '2.5rem',
            },
            // 柔和的阴影
            boxShadow: {
                'kawaii': '0 4px 20px rgba(255, 182, 193, 0.15)',
                'kawaii-lg': '0 10px 40px rgba(255, 182, 193, 0.25)',
                'kawaii-pink': '0 4px 20px rgba(255, 45, 140, 0.2)',
                'kawaii-purple': '0 4px 20px rgba(168, 85, 247, 0.2)',
            },
            // 可爱的字体
            fontFamily: {
                'kawaii': ['Quicksand', 'Noto Sans SC', 'sans-serif'],
                'cute': ['Comic Sans MS', 'Noto Sans SC', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
