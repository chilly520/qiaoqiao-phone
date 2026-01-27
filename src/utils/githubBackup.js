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
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))

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
                content = decodeURIComponent(escape(atob(rawContent)))
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
        return JSON.parse(atob(file.content.replace(/\n/g, '')))
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
        if (!config.token.startsWith('ghp_')) {
            return { valid: false, error: 'Token 格式不正确' }
        }
        return { valid: true }
    }
}

export default GitHubBackup
