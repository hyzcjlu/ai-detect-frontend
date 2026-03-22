<template>
  <div class="upload-page">
    <a-card class="upload-card">
      <template #title>
        <div class="card-title">
          <UploadOutlined class="title-icon" />
          <span>上传图片进行检测</span>
        </div>
      </template>
      
      <p class="description">
        支持 JPG、PNG、BMP 格式图片，单张图片最大 10MB，可同时上传多张图片进行批量检测。
      </p>
      
      <!-- 上传区域 -->
      <a-upload-dragger
        v-model:file-list="fileList"
        name="file"
        :multiple="true"
        :before-upload="beforeUpload"
        :show-upload-list="false"
        accept=".jpg,.jpeg,.png,.bmp,.webp"
        class="upload-dragger"
      >
        <div v-if="selectedFiles.length === 0" class="upload-placeholder">
          <p class="upload-icon">
            <InboxOutlined />
          </p>
          <p class="upload-text">点击或拖拽图片到此区域上传</p>
          <p class="upload-hint">支持 JPG、PNG、BMP 格式，可批量上传</p>
        </div>
        
        <div v-else class="upload-placeholder upload-more">
          <PlusOutlined class="add-icon" />
          <span>继续添加图片</span>
        </div>
      </a-upload-dragger>
      
      <!-- 已选文件列表 -->
      <div v-if="selectedFiles.length > 0" class="file-list">
        <div class="file-list-header">
          <span>已选择 {{ selectedFiles.length }} 张图片</span>
          <a-button type="link" danger size="small" @click="clearAllFiles">
            <DeleteOutlined /> 清空全部
          </a-button>
        </div>
        
        <div class="file-grid">
          <div 
            v-for="(file, index) in selectedFiles" 
            :key="file.uid"
            class="file-item"
          >
            <img :src="file.preview" alt="预览" class="file-thumb" />
            <div class="file-item-info">
              <span class="file-name" :title="file.name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
            </div>
            <a-button 
              type="text" 
              danger 
              size="small" 
              class="file-remove"
              @click="removeFile(index)"
            >
              <CloseOutlined />
            </a-button>
          </div>
        </div>
      </div>
      
      <div class="action-bar">
        <a-button 
          type="primary" 
          size="large" 
          :disabled="selectedFiles.length === 0"
          :loading="uploading"
          @click="handleUpload"
        >
          <template #icon><CloudUploadOutlined /></template>
          {{ selectedFiles.length > 1 ? `批量检测 (${selectedFiles.length}张)` : '开始检测' }}
        </a-button>
      </div>
    </a-card>
    
    <!-- 最近检测记录 -->
    <a-card class="recent-card" title="最近检测">
      <a-empty v-if="recentRecords.length === 0" description="暂无检测记录" />
      <a-list v-else :data-source="recentRecords" size="small">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #avatar>
                <a-avatar :src="item.thumbnail" shape="square" :size="48" />
              </template>
              <template #title>
                <a @click="viewResult(item.taskId)">{{ item.fileName }}</a>
              </template>
              <template #description>
                {{ formatTime(item.createdAt) }}
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-tag :color="getStatusColor(item.status)">
                {{ getStatusText(item.status) }}
              </a-tag>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
    
    <!-- 批量上传进度弹窗 -->
    <a-modal
      v-model:open="batchModalVisible"
      title="批量检测进度"
      :footer="null"
      :closable="!uploading"
      :maskClosable="false"
    >
      <div class="batch-progress">
        <a-progress 
          :percent="Math.round((uploadedCount / selectedFiles.length) * 100)" 
          :status="uploading ? 'active' : 'success'"
        />
        <p class="batch-status">
          已上传 {{ uploadedCount }} / {{ selectedFiles.length }} 张图片
        </p>
        <a-list :data-source="uploadResults" size="small" class="batch-results">
          <template #renderItem="{ item }">
            <a-list-item>
              <span>{{ item.fileName }}</span>
              <template #actions>
                <a-tag v-if="item.success" color="success">成功</a-tag>
                <a-tag v-else color="error">失败</a-tag>
              </template>
            </a-list-item>
          </template>
        </a-list>
        <div v-if="!uploading && uploadResults.length > 0" class="batch-actions">
          <a-button type="primary" @click="viewBatchResults">
            查看检测结果
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  UploadOutlined,
  InboxOutlined,
  PlusOutlined,
  DeleteOutlined,
  CloseOutlined,
  CloudUploadOutlined
} from '@ant-design/icons-vue'
import { uploadImage, getRecentRecords } from '@/api/detection'

const router = useRouter()

const fileList = ref([])
const selectedFiles = ref([])
const uploading = ref(false)
const recentRecords = ref([])

// 批量上传状态
const batchModalVisible = ref(false)
const uploadedCount = ref(0)
const uploadResults = ref([])

// 支持的格式
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp']

// 上传前校验
const beforeUpload = (file) => {
  // 检查格式
  if (!SUPPORTED_TYPES.includes(file.type)) {
    message.error(`${file.name} 格式不支持，已自动过滤`)
    return false
  }
  
  // 检查大小
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error(`${file.name} 超过10MB限制，已自动过滤`)
    return false
  }
  
  // 检查是否已存在
  const exists = selectedFiles.value.some(f => f.name === file.name && f.size === file.size)
  if (exists) {
    message.warning(`${file.name} 已在列表中`)
    return false
  }
  
  // 添加到列表
  selectedFiles.value.push({
    uid: file.uid || Date.now() + Math.random(),
    file: file,
    name: file.name,
    size: file.size,
    preview: URL.createObjectURL(file)
  })
  
  return false // 阻止自动上传
}

// 移除单个文件
const removeFile = (index) => {
  const file = selectedFiles.value[index]
  URL.revokeObjectURL(file.preview)
  selectedFiles.value.splice(index, 1)
}

// 清空全部文件
const clearAllFiles = () => {
  selectedFiles.value.forEach(f => URL.revokeObjectURL(f.preview))
  selectedFiles.value = []
  fileList.value = []
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 处理上传
const handleUpload = async () => {
  if (selectedFiles.value.length === 0) return
  
  // 单张直接跳转
  if (selectedFiles.value.length === 1) {
    uploading.value = true
    try {
      const result = await uploadImage(selectedFiles.value[0].file)
      message.success('上传成功，正在检测中...')
      router.push(`/result/${result.taskId}`)
    } catch (error) {
      message.error('上传失败：' + (error.message || '未知错误'))
    } finally {
      uploading.value = false
    }
    return
  }
  
  // 批量上传
  uploading.value = true
  batchModalVisible.value = true
  uploadedCount.value = 0
  uploadResults.value = []
  
  for (const item of selectedFiles.value) {
    try {
      const result = await uploadImage(item.file)
      uploadResults.value.push({
        fileName: item.name,
        taskId: result.taskId,
        success: true
      })
    } catch (error) {
      uploadResults.value.push({
        fileName: item.name,
        success: false,
        error: error.message
      })
    }
    uploadedCount.value++
  }
  
  uploading.value = false
  message.success(`批量上传完成，成功 ${uploadResults.value.filter(r => r.success).length} 张`)
}

// 查看批量结果
const viewBatchResults = () => {
  batchModalVisible.value = false
  // 如果有成功的，跳转到第一个结果；否则跳转到管理页
  const firstSuccess = uploadResults.value.find(r => r.success)
  if (firstSuccess) {
    router.push(`/result/${firstSuccess.taskId}`)
  } else {
    router.push('/admin')
  }
  clearAllFiles()
}

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 获取状态颜色
const getStatusColor = (status) => {
  const colors = {
    pending: 'default',
    uploading: 'processing',
    detecting: 'processing',
    completed: 'success',
    failed: 'error'
  }
  return colors[status] || 'default'
}

// 获取状态文字
const getStatusText = (status) => {
  const texts = {
    pending: '待处理',
    uploading: '上传中',
    detecting: '检测中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

// 查看结果
const viewResult = (taskId) => {
  router.push(`/result/${taskId}`)
}

// 获取最近记录
onMounted(async () => {
  try {
    recentRecords.value = await getRecentRecords()
  } catch (error) {
    console.error('获取最近记录失败', error)
  }
})
</script>

<style scoped>
.upload-page {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

@media (max-width: 992px) {
  .upload-page {
    grid-template-columns: 1fr;
  }
}

.upload-card {
  height: fit-content;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: var(--primary-color);
}

.description {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.upload-dragger {
  margin-bottom: 16px;
}

.upload-placeholder {
  padding: 40px 20px;
}

.upload-more {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--primary-color);
}

.add-icon {
  font-size: 20px;
}

.upload-icon {
  font-size: 48px;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  color: var(--text-color);
}

.upload-hint {
  font-size: 14px;
  color: var(--text-secondary);
}

/* 文件列表 */
.file-list {
  margin-bottom: 16px;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.file-item {
  position: relative;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.3s;
}

.file-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.file-thumb {
  width: 100%;
  height: 100px;
  object-fit: cover;
}

.file-item-info {
  padding: 8px;
  background: #fafafa;
}

.file-name {
  display: block;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: #999;
}

.file-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  padding: 0;
  opacity: 0;
  transition: opacity 0.3s;
}

.file-item:hover .file-remove {
  opacity: 1;
}

.file-remove:hover {
  background: #ff4d4f;
  color: #fff;
}

.action-bar {
  text-align: center;
  padding-top: 8px;
}

.recent-card {
  height: fit-content;
}

/* 批量上传弹窗 */
.batch-progress {
  text-align: center;
}

.batch-status {
  margin: 16px 0;
  color: var(--text-secondary);
}

.batch-results {
  max-height: 200px;
  overflow-y: auto;
  margin: 16px 0;
  text-align: left;
}

.batch-actions {
  margin-top: 16px;
}
</style>
