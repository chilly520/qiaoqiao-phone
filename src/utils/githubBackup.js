/**
 * GitHub 云备份工具
 * 用于将聊天记录同步到 GitHub 私有仓库
 */

class GitHubBackup {
    constructor(config) {
        this.token = config.token
        this.owner = config.owner
        this.repo = config.repo
        this.fileName = config.fileName || 'ephone_backup.json'
        this.baseUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents`
    }

    /**
     * 全量上传
     */
    async uploadFull(data) {
        try {
            // [BUG FIX] escape/unescape 已弃用, 且对 4 字节 CJK/emoji 字符会损坏.
            // 改用 TextEncoder/TextDecoder 做 UTF-8 base64 编解码.
            const jsonStr = JSON.stringify(data, null, 2)
            const encoder = new TextEncoder()
            const bytes = encoder.encode(jsonStr)
            let binaryStr = ''
            const chunkSize = 8192
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binaryStr += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
            }
            const content = btoa(binaryStr)

            // 获取现有文件的 SHA（如果存在）
            let sha = null
            try {
                const existing = await this.getFile(this.fileName)
                sha = existing.sha
            } catch (e) {
                // 文件不存在，跳过
            }

            const response = await fetch(`${this.baseUrl}/${this.fileName}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Full backup at ${new Date().toISOString()}`,
                    content: content,
                    ...(sha && { sha })
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || 'Upload failed')
            }

            return await response.json()
        } catch (error) {
            console.error('[GitHub Backup] Upload failed:', error)
            throw error
        }
    }

    /**
     * 全量恢复
     */
    async downloadFull() {
        try {
            const file = await this.getFile(this.fileName)
            if (!file || !file.content) throw new Error('云端文件内容为空')

            // Fix Chinese Character Decoding
            const rawContent = file.content.replace(/\n/g, '')
            let content = ''
            try {
                // [BUG FIX] escape/unescape 已弃用, 改用 TextDecoder 做 UTF-8 base64 解码
                const binaryStr = atob(rawContent)
                const bytes = new Uint8Array(binaryStr.length)
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i)
                }
                content = new TextDecoder().decode(bytes)
            } catch (e) {
                // Fallback for different encoding strategies
                content = atob(rawContent)
            }

            if (!content || content.trim() === '' || content === '{}') {
                throw new Error('解析内容为空或无效');
            }
            const parsed = JSON.parse(content);
            if (!parsed || Object.keys(parsed).length === 0) {
                throw new Error('备份数据包为空 (无有效负载)');
            }
            return parsed;
        } catch (error) {
            console.error('[GitHub Backup] Download failed:', error);
            throw error
        }
    }

    /**
     * Git 流式上传（分块上传大文件）
     */
    async uploadStream(data, onProgress) {
        try {
            const jsonStr = JSON.stringify(data, null, 2)
            const chunks = this.splitIntoChunks(jsonStr, 1024 * 1024) // 1MB per chunk

            for (let i = 0; i < chunks.length; i++) {
                const chunkFileName = `${this.fileName}.part${i}`
                const content = btoa(chunks[i])

                await fetch(`${this.baseUrl}/${chunkFileName}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Upload chunk ${i + 1}/${chunks.length}`,
                        content: content
                    })
                })

                if (onProgress) {
                    onProgress((i + 1) / chunks.length * 100)
                }
            }

            // 上传元数据
            await this.uploadMetadata({
                chunks: chunks.length,
                totalSize: jsonStr.length,
                timestamp: Date.now()
            })

            return { success: true, chunks: chunks.length }
        } catch (error) {
            console.error('[GitHub Backup] Stream upload failed:', error)
            throw error
        }
    }

    /**
     * Git 流式导入
     */
    async downloadStream(onProgress) {
        try {
            // 读取元数据
            const metadata = await this.getMetadata()
            const chunks = []

            for (let i = 0; i < metadata.chunks; i++) {
                const chunkFileName = `${this.fileName}.part${i}`
                const file = await this.getFile(chunkFileName)
                chunks.push(atob(file.content.replace(/\n/g, '')))

                if (onProgress) {
                    onProgress((i + 1) / metadata.chunks * 100)
                }
            }

            const jsonStr = chunks.join('')
            return JSON.parse(jsonStr)
        } catch (error) {
            console.error('[GitHub Backup] Stream download failed:', error)
            throw error
        }
    }

    /**
     * 获取文件
     */
    async getFile(fileName) {
        const response = await fetch(`${this.baseUrl}/${fileName}`, {
            headers: {
                'Authorization': `token ${this.token}`,
            }
        })

        if (!response.ok) {
            throw new Error(`File not found: ${fileName}`)
        }

        return await response.json()
    }

    /**
     * 上传元数据
     */
    async uploadMetadata(metadata) {
        const content = btoa(JSON.stringify(metadata))
        await fetch(`${this.baseUrl}/${this.fileName}.meta`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Update metadata',
                content: content
            })
        })
    }

    /**
     * 获取元数据
     */
    async getMetadata() {
        const file = await this.getFile(`${this.fileName}.meta`)
        // [BUG FIX] atob/JSON.parse 在 base64 损坏或内容非 JSON 时会抛错, 需 try/catch
        try {
            return JSON.parse(atob(file.content.replace(/\n/g, '')))
        } catch (e) {
            console.error('[GitHubBackup] Failed to parse metadata:', e)
            return null
        }
    }

    /**
     * 分割字符串为块
     */
    splitIntoChunks(str, chunkSize) {
        const chunks = []
        for (let i = 0; i < str.length; i += chunkSize) {
            chunks.push(str.slice(i, i + chunkSize))
        }
        return chunks
    }

    /**
     * 验证配置
     */
    static validateConfig(config) {
        if (!config.token || !config.owner || !config.repo) {
            return { valid: false, error: '请填写完整的 GitHub 配置' }
        }
        // [BUG FIX] 仅允许 ghp_ 前缀会拒绝 fine-grained PAT (github_pat_) 和
        // OAuth/app tokens (gho_/ghu_/ghs_). 放宽为支持所有 GitHub token 前缀.
        if (!/^ghp_|^github_pat_|^gh[ous]_/.test(config.token)) {
            return { valid: false, error: 'Token 格式不正确（需以 ghp_、github_pat_ 或 gh[o/u/s]_ 开头）' }
        }
        return { valid: true }
    }
}

export default GitHubBackup
