/**
 * 内容管理模块
 * 负责管理帖子（Blogs）和视频（Vedios）内容的存储和读取
 * 
 * @author yxpil
 * @responsibility 负责内容管理，包括博客和视频的存储、读取、加密和元数据管理
 * @domain yxpil.com
 * @created 2024-03-13
 * @last-modified 2024-03-13
 * @branch main
 * 
 * @moduleDescription
 * 内容管理核心模块，提供以下功能：
 * - 博客内容管理（创建、读取、更新、删除）
 * - 视频内容管理（创建、读取、更新、删除）
 * - 内容加密和解密
 * - 元数据管理（标签、时间戳、作者信息）
 * - 文件系统操作
 * - 内容搜索和过滤
 * 
 * @usage
 * 通过 ContentManager 类实例化使用，提供统一的内容管理接口
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../Tools/Logs.js');
const crypto = require('crypto');

class ContentManager {
    constructor() {
        this.blogsPath = path.join(__dirname, '../../Data/Blogs');
        this.videosPath = path.join(__dirname, '../../Data/Vedios');
        this.ensureDirectories();
    }

    /**
     * 确保必要的目录存在
     */
    ensureDirectories() {
        try {
            if (!fs.existsSync(this.blogsPath)) {
                fs.mkdirSync(this.blogsPath, { recursive: true });
                logger.info('CONTENT', '创建博客目录', { path: this.blogsPath });
            }
            if (!fs.existsSync(this.videosPath)) {
                fs.mkdirSync(this.videosPath, { recursive: true });
                logger.info('CONTENT', '创建视频目录', { path: this.videosPath });
            }
        } catch (error) {
            logger.error('CONTENT', '创建内容目录失败', error);
            throw error;
        }
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * 获取当前时间戳
     */
    getCurrentTimestamp() {
        return new Date().toISOString();
    }

    /**
     * 创建新帖子
     */
    async createBlog(blogData) {
        try {
            const id = this.generateId();
            const blog = {
                id,
                title: blogData.title || '无标题',
                content: blogData.content || [],
                tags: blogData.tags || [],
                createdAt: this.getCurrentTimestamp(),
                updatedAt: this.getCurrentTimestamp(),
                author: blogData.author || '匿名用户',
                views: 0,
                likes: 0,
                comments: []
            };

            // 验证内容结构
            this.validateBlogContent(blog.content);

            const filePath = path.join(this.blogsPath, `${id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(blog, null, 2));
            
            logger.info('CONTENT', '创建新帖子成功', { id, title: blog.title });
            return blog;
        } catch (error) {
            logger.error('CONTENT', '创建帖子失败', error);
            throw error;
        }
    }

    /**
     * 创建新视频
     */
    async createVideo(videoData) {
        try {
            const id = this.generateId();
            const video = {
                id,
                title: videoData.title || '无标题视频',
                description: videoData.description || '',
                tags: videoData.tags || [],
                videoPath: videoData.videoPath || '',
                thumbnailPath: videoData.thumbnailPath || '',
                duration: videoData.duration || 0,
                createdAt: this.getCurrentTimestamp(),
                updatedAt: this.getCurrentTimestamp(),
                author: videoData.author || '匿名用户',
                views: 0,
                likes: 0,
                comments: []
            };

            const filePath = path.join(this.videosPath, `${id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(video, null, 2));
            
            logger.info('CONTENT', '创建新视频成功', { id, title: video.title });
            return video;
        } catch (error) {
            logger.error('CONTENT', '创建视频失败', error);
            throw error;
        }
    }

    /**
     * 验证帖子内容结构
     */
    validateBlogContent(content) {
        if (!Array.isArray(content)) {
            throw new Error('内容必须是数组');
        }

        for (const item of content) {
            if (!item.type || !['text', 'image', 'code'].includes(item.type)) {
                throw new Error('内容项必须有有效的类型 (text, image, code)');
            }

            if (item.type === 'text' && typeof item.content !== 'string') {
                throw new Error('文本内容必须是字符串');
            }

            if (item.type === 'image' && typeof item.url !== 'string') {
                throw new Error('图片URL必须是字符串');
            }

            if (item.type === 'code' && typeof item.content !== 'string') {
                throw new Error('代码内容必须是字符串');
            }
        }
    }

    /**
     * 获取所有帖子
     */
    async getAllBlogs(limit = 50, offset = 0) {
        try {
            const files = fs.readdirSync(this.blogsPath)
                .filter(file => file.endsWith('.json'))
                .sort((a, b) => {
                    // 按创建时间倒序排列
                    const statA = fs.statSync(path.join(this.blogsPath, a));
                    const statB = fs.statSync(path.join(this.blogsPath, b));
                    return statB.mtime - statA.mtime;
                });

            const total = files.length;
            const paginatedFiles = files.slice(offset, offset + limit);
            
            const blogs = paginatedFiles.map(file => {
                const filePath = path.join(this.blogsPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(content);
            });

            return {
                blogs,
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            };
        } catch (error) {
            logger.error('CONTENT', '获取帖子列表失败', error);
            throw error;
        }
    }

    /**
     * 获取所有视频
     */
    async getAllVideos(limit = 50, offset = 0) {
        try {
            const files = fs.readdirSync(this.videosPath)
                .filter(file => file.endsWith('.json'))
                .sort((a, b) => {
                    // 按创建时间倒序排列
                    const statA = fs.statSync(path.join(this.videosPath, a));
                    const statB = fs.statSync(path.join(this.videosPath, b));
                    return statB.mtime - statA.mtime;
                });

            const total = files.length;
            const paginatedFiles = files.slice(offset, offset + limit);
            
            const videos = paginatedFiles.map(file => {
                const filePath = path.join(this.videosPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(content);
            });

            return {
                videos,
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            };
        } catch (error) {
            logger.error('CONTENT', '获取视频列表失败', error);
            throw error;
        }
    }

    /**
     * 获取单个帖子
     */
    async getBlogById(id) {
        try {
            const filePath = path.join(this.blogsPath, `${id}.json`);
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const blog = JSON.parse(content);
            
            // 增加浏览量
            blog.views++;
            blog.updatedAt = this.getCurrentTimestamp();
            
            fs.writeFileSync(filePath, JSON.stringify(blog, null, 2));
            
            return blog;
        } catch (error) {
            logger.error('CONTENT', '获取帖子失败', error);
            throw error;
        }
    }

    /**
     * 获取单个视频
     */
    async getVideoById(id) {
        try {
            const filePath = path.join(this.videosPath, `${id}.json`);
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const video = JSON.parse(content);
            
            // 增加浏览量
            video.views++;
            video.updatedAt = this.getCurrentTimestamp();
            
            fs.writeFileSync(filePath, JSON.stringify(video, null, 2));
            
            return video;
        } catch (error) {
            logger.error('CONTENT', '获取视频失败', error);
            throw error;
        }
    }

    /**
     * 删除帖子
     */
    async deleteBlog(id) {
        try {
            const filePath = path.join(this.blogsPath, `${id}.json`);
            if (!fs.existsSync(filePath)) {
                throw new Error('帖子不存在');
            }

            fs.unlinkSync(filePath);
            logger.info('CONTENT', '删除帖子成功', { id });
            return true;
        } catch (error) {
            logger.error('CONTENT', '删除帖子失败', error);
            throw error;
        }
    }

    /**
     * 删除视频
     */
    async deleteVideo(id) {
        try {
            const filePath = path.join(this.videosPath, `${id}.json`);
            if (!fs.existsSync(filePath)) {
                throw new Error('视频不存在');
            }

            fs.unlinkSync(filePath);
            logger.info('CONTENT', '删除视频成功', { id });
            return true;
        } catch (error) {
            logger.error('CONTENT', '删除视频失败', error);
            throw error;
        }
    }

    /**
     * 点赞视频
     */
    async likeVideo(id) {
        try {
            const filePath = path.join(this.videosPath, `${id}.json`);
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const video = JSON.parse(content);
            
            // 增加点赞数
            video.likes = (video.likes || 0) + 1;
            video.updatedAt = this.getCurrentTimestamp();
            
            fs.writeFileSync(filePath, JSON.stringify(video, null, 2));
            
            logger.info('CONTENT', '视频点赞成功', { id, likes: video.likes });
            return video;
        } catch (error) {
            logger.error('CONTENT', '视频点赞失败', error);
            throw error;
        }
    }

    /**
     * 搜索内容
     */
    async searchContent(query, type = 'all', limit = 20) {
        try {
            const results = [];
            const lowerQuery = query.toLowerCase();

            if (type === 'all' || type === 'blogs') {
                const { blogs } = await this.getAllBlogs(1000, 0); // 获取所有帖子
                for (const blog of blogs) {
                    if (this.contentMatchesQuery(blog, lowerQuery)) {
                        results.push({ type: 'blog', data: blog });
                    }
                }
            }

            if (type === 'all' || type === 'videos') {
                const { videos } = await this.getAllVideos(1000, 0); // 获取所有视频
                for (const video of videos) {
                    if (this.contentMatchesQuery(video, lowerQuery)) {
                        results.push({ type: 'video', data: video });
                    }
                }
            }

            return results.slice(0, limit);
        } catch (error) {
            logger.error('CONTENT', '搜索内容失败', error);
            throw error;
        }
    }

    /**
     * 检查内容是否匹配搜索查询
     */
    contentMatchesQuery(content, query) {
        const searchableFields = ['title', 'description', 'tags'];
        
        for (const field of searchableFields) {
            if (content[field]) {
                const fieldValue = Array.isArray(content[field]) 
                    ? content[field].join(' ') 
                    : content[field];
                
                if (fieldValue.toLowerCase().includes(query)) {
                    return true;
                }
            }
        }

        // 对于帖子，还要搜索内容
        if (content.content && Array.isArray(content.content)) {
            for (const item of content.content) {
                if (item.type === 'text' && item.content.toLowerCase().includes(query)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 获取统计信息
     */
    async getStats() {
        try {
            const blogFiles = fs.readdirSync(this.blogsPath).filter(f => f.endsWith('.json'));
            const videoFiles = fs.readdirSync(this.videosPath).filter(f => f.endsWith('.json'));

            let totalBlogViews = 0;
            let totalVideoViews = 0;
            let totalBlogLikes = 0;
            let totalVideoLikes = 0;

            // 计算帖子统计
            for (const file of blogFiles) {
                const content = fs.readFileSync(path.join(this.blogsPath, file), 'utf8');
                const blog = JSON.parse(content);
                totalBlogViews += blog.views || 0;
                totalBlogLikes += blog.likes || 0;
            }

            // 计算视频统计
            for (const file of videoFiles) {
                const content = fs.readFileSync(path.join(this.videosPath, file), 'utf8');
                const video = JSON.parse(content);
                totalVideoViews += video.views || 0;
                totalVideoLikes += video.likes || 0;
            }

            return {
                totalBlogs: blogFiles.length,
                totalVideos: videoFiles.length,
                totalBlogViews,
                totalVideoViews,
                totalBlogLikes,
                totalVideoLikes,
                totalContent: blogFiles.length + videoFiles.length,
                totalViews: totalBlogViews + totalVideoViews,
                totalLikes: totalBlogLikes + totalVideoLikes
            };
        } catch (error) {
            logger.error('CONTENT', '获取统计信息失败', error);
            throw error;
        }
    }
}

module.exports = ContentManager;