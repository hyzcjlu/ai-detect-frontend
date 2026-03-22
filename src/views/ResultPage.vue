<template>
  <div class="result-page">
    <!-- 进度条区域 -->
    <a-card class="progress-card">
      <a-steps :current="currentStep" :status="stepStatus">
        <a-step title="上传中" description="图片正在上传" />
        <a-step title="检测中" description="AI正在分析图片" />
        <a-step title="已完成" description="检测结果已生成" />
      </a-steps>
    </a-card>
    
    <!-- 主要内容区域 -->
    <div class="content-area">
      <!-- 图片标注区域 -->
      <a-card class="image-card" title="检测结果可视化">
        <template #extra>
          <a-button v-if="result" type="link" @click="downloadReport">
            <DownloadOutlined /> 下载报告
          </a-button>
        </template>
        
        <a-spin v-if="loading" tip="加载中..." />
        
        <template v-else-if="result">
          <ImageAnnotation
            v-if="result.boxes.length > 0"
            :src="imageUrl"
            :boxes="result.boxes"
            alt="检测图片"
          />
          
          <div v-else class="image-container">
            <img :src="imageUrl" alt="检测图片" class="detection-image" />
          </div>
          
          <div v-if="result.boxes.length === 0" class="no-detection">
            <CheckCircleOutlined class="success-icon" />
            <p>未检测到篡改痕迹</p>
          </div>
        </template>
      </a-card>
      
      <!-- 报告详情 -->
      <a-card class="report-card" title="检测报告">
        <a-skeleton v-if="loading" active :paragraph="{ rows: 6 }" />
        
        <template v-else-if="result">
          <!-- 总体结论 -->
          <a-alert
            :type="result.isTampered ? 'warning' : 'success'"
            :message="result.isTampered ? '检测到疑似篡改' : '图片未检测到篡改痕迹'"
            show-icon
            class="conclusion-alert"
          />
          
          <!-- 可信度评分 -->
          <div class="score-section">
            <h4>可信度评分</h4>
            <a-progress 
              :percent="result.confidenceScore" 
              :stroke-color="getScoreColor(result.confidenceScore)"
              :format="percent => `${percent}%`"
            />
          </div>
          
          <!-- 详细报告 -->
          <div class="detail-section">
            <h4>详细分析</h4>
            <a-list :data-source="result.details" size="small">
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #avatar>
                      <WarningOutlined v-if="item.type === 'warning'" style="color: #faad14" />
                      <InfoCircleOutlined v-else style="color: #1890ff" />
                    </template>
                    <template #title>{{ item.title }}</template>
                    <template #description>{{ item.description }}</template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </div>
          
          <!-- 检测时间信息 -->
          <div class="meta-section">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="任务ID">{{ taskId }}</a-descriptions-item>
              <a-descriptions-item label="文件名">{{ result.fileName }}</a-descriptions-item>
              <a-descriptions-item label="图片尺寸">{{ result.imageSize }}</a-descriptions-item>
              <a-descriptions-item label="检测时间">{{ formatTime(result.completedAt) }}</a-descriptions-item>
              <a-descriptions-item label="耗时">{{ result.processingTime }}秒</a-descriptions-item>
            </a-descriptions>
          </div>
        </template>
      </a-card>
    </div>
    
    <!-- 底部操作 -->
    <div class="action-bar">
      <a-button @click="router.push('/')">
        <PlusOutlined /> 继续检测
      </a-button>
      <a-button type="primary" @click="router.push('/admin')">
        <UnorderedListOutlined /> 查看所有记录
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DownloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UnorderedListOutlined
} from '@ant-design/icons-vue'
import { getTaskStatus, getTaskResult } from '@/api/detection'
import ImageAnnotation from '@/components/ImageAnnotation.vue'

const route = useRoute()
const router = useRouter()
const taskId = route.params.taskId

const loading = ref(true)
const result = ref(null)
const currentStep = ref(0)
const stepStatus = ref('process')
const imageUrl = ref('')

let pollingTimer = null

// 轮询机制
const startPolling = () => {
  pollingTimer = setInterval(async () => {
    try {
      const status = await getTaskStatus(taskId)
      
      if (status.status === 'uploading') {
        currentStep.value = 0
      } else if (status.status === 'detecting') {
        currentStep.value = 1
      } else if (status.status === 'completed') {
        currentStep.value = 2
        stepStatus.value = 'finish'
        stopPolling()
        await loadResult()
      } else if (status.status === 'failed') {
        stepStatus.value = 'error'
        stopPolling()
        message.error('检测失败：' + status.error)
      }
    } catch (error) {
      console.error('轮询失败', error)
    }
  }, 2000) // 每2秒轮询一次
}

const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// 加载检测结果
const loadResult = async () => {
  try {
    result.value = await getTaskResult(taskId)
    imageUrl.value = result.value.imageUrl
  } catch (error) {
    message.error('获取结果失败')
  } finally {
    loading.value = false
  }
}

// 获取评分颜色
const getScoreColor = (score) => {
  if (score >= 80) return '#52c41a'
  if (score >= 60) return '#faad14'
  return '#ff4d4f'
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 下载报告
const downloadReport = () => {
  message.info('报告下载功能开发中')
}

onMounted(() => {
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.result-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.progress-card {
  padding: 8px 0;
}

.content-area {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 24px;
}

@media (max-width: 1200px) {
  .content-area {
    grid-template-columns: 1fr;
  }
}

.image-card {
  height: fit-content;
}

.image-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.detection-image {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
}

.no-detection {
  text-align: center;
  padding: 40px;
  color: #52c41a;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.report-card {
  height: fit-content;
}

.conclusion-alert {
  margin-bottom: 20px;
}

.score-section,
.detail-section,
.meta-section {
  margin-bottom: 20px;
}

.score-section h4,
.detail-section h4 {
  margin-bottom: 12px;
  color: var(--text-color);
}

.action-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;
}
</style>
