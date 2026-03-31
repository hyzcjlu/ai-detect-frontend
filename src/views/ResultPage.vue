<template>
  <div class="result-page">

    <!-- 批量图片切换器（上传了多张才显示） -->
    <a-card v-if="batchTaskIds.length > 1" class="batch-switcher-card" size="small">
      <template #title>
        <span>批量检测结果</span>
        <a-tag style="margin-left: 8px">共 {{ batchTaskIds.length }} 张</a-tag>
      </template>
      <div class="batch-switcher">
        <div
          v-for="(tid, idx) in batchTaskIds"
          :key="tid"
          class="batch-thumb-item"
          :class="{ active: tid === currentTaskId }"
          @click="switchTask(tid)"
        >
          <div class="batch-thumb-image">
            <img
              v-if="taskResults[tid]?.imageUrl"
              :src="taskResults[tid].imageUrl"
              class="batch-thumb-img"
            />
            <div v-else class="batch-thumb-placeholder">
              <FileImageOutlined />
              <span>检测中...</span>
            </div>
          </div>
          <div class="batch-thumb-footer">
            <span class="batch-thumb-no">图片 {{ idx + 1 }}</span>
            <a-tag :color="getTaskStatusColor(tid)" size="small">
              {{ getTaskStatusText(tid) }}
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 进度条 -->
    <a-card class="progress-card">
      <a-steps :current="currentStep" :status="stepStatus">
        <a-step title="上传中" description="图片正在上传" />
        <a-step title="检测中" description="AI正在分析图片" />
        <a-step title="已完成" description="检测结果已生成" />
      </a-steps>
    </a-card>

    <!-- 主内容 -->
    <div class="content-area">

      <!-- 左侧：图片 + bbox 面板 -->
      <div class="left-panel">
        <!-- 图片标注 -->
        <a-card class="image-card" title="检测结果可视化">
          <template #extra>
            <a-button v-if="result" type="link" @click="downloadReport">
              <DownloadOutlined /> 下载报告
            </a-button>
          </template>

          <a-spin v-if="loading" tip="加载中..." style="padding: 60px 0; display: block; text-align: center" />

          <template v-else-if="result">
            <ImageAnnotation
              v-if="result.boxes && result.boxes.length > 0"
              :src="imageUrl"
              :boxes="result.boxes"
              :highlight-index="highlightedBoxIndex"
              @box-click="onBoxClick"
              @box-move="onBoxMove"
              @box-resize="onBoxResize"
              alt="检测图片"
            />
            <div v-else class="image-container">
              <img :src="imageUrl" alt="检测图片" class="detection-image" />
            </div>

            <div v-if="!result.boxes || result.boxes.length === 0" class="no-detection">
              <CheckCircleOutlined class="success-icon" />
              <p>未检测到篡改痕迹</p>
            </div>
          </template>
        </a-card>

        <!-- bbox 坐标交互面板 -->
        <a-card
          v-if="result && result.boxes && result.boxes.length > 0"
          class="bbox-card"
          size="small"
        >
          <template #title>
            <span class="bbox-card-title">
              <span class="bbox-legend bbox-legend-red">篡改</span>
              <span class="bbox-legend bbox-legend-yellow">可疑</span>
              <span class="bbox-legend bbox-legend-green">正常</span>
            </span>
            检测区域（{{ result.boxes.length }} 处）
            <span class="bbox-hint">点击行高亮对应区域</span>
          </template>

          <div class="bbox-list">
            <div
              v-for="(box, i) in result.boxes"
              :key="i"
              class="bbox-item"
              :class="[
                { 'bbox-item-active': highlightedBoxIndex === i },
                'bbox-item-' + getBoxStatus(box)
              ]"
              @click="onBoxClick(i)"
            >
              <!-- 色块序号 -->
              <div class="bbox-index" :class="'bbox-index-' + getBoxStatus(box)">{{ i + 1 }}</div>

              <!-- 标签 + 坐标 -->
              <div class="bbox-content">
                <div class="bbox-label-row">
                  <span class="bbox-label-text">{{ box.label || '检测区域' }}</span>
                  <a-tag
                    v-if="box.confidence"
                    :color="getBoxStatus(box) === 'red' ? 'red' : getBoxStatus(box) === 'yellow' ? 'orange' : 'green'"
                    size="small"
                  >
                    置信度 {{ Math.round(box.confidence * 100) }}%
                  </a-tag>
                </div>
                <div class="bbox-coords-row">
                  <code class="coord-code">
                    [{{ box.x1 }}, {{ box.y1 }}, {{ box.x2 }}, {{ box.y2 }}]
                  </code>
                  <span class="coord-size">
                    {{ box.x2 - box.x1 }} × {{ box.y2 - box.y1 }} px
                  </span>
                </div>
              </div>

              <!-- 激活指示 -->
              <div class="bbox-arrow" v-if="highlightedBoxIndex === i">
                <AimOutlined style="color: #ff4d4f" />
              </div>
            </div>
          </div>
        </a-card>
      </div>

      <!-- 右侧：检测报告 -->
      <a-card class="report-card" title="检测报告">
        <a-skeleton v-if="loading" active :paragraph="{ rows: 6 }" />

        <template v-else-if="result">
          <a-alert
            :type="result.isTampered ? 'warning' : 'success'"
            :message="result.isTampered ? '检测到疑似篡改' : '图片未检测到篡改痕迹'"
            show-icon
            class="conclusion-alert"
          />

          <div class="score-section">
            <h4>可信度评分</h4>
            <a-progress
              :percent="result.confidenceScore"
              :stroke-color="getScoreColor(result.confidenceScore)"
              :format="pct => `${pct}%`"
            />
          </div>

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

          <div class="meta-section">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="任务ID">{{ currentTaskId }}</a-descriptions-item>
              <a-descriptions-item label="文件名">{{ result.fileName }}</a-descriptions-item>
              <a-descriptions-item label="图片尺寸">{{ result.imageSize }}</a-descriptions-item>
              <a-descriptions-item label="检测时间">{{ formatTime(result.completedAt) }}</a-descriptions-item>
              <a-descriptions-item label="耗时">{{ result.processingTime }} 秒</a-descriptions-item>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DownloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  FileImageOutlined,
  AimOutlined
} from '@ant-design/icons-vue'
import { getTaskStatus, getTaskResult } from '@/api/detection'
import ImageAnnotation from '@/components/ImageAnnotation.vue'

const route = useRoute()
const router = useRouter()

const primaryTaskId = route.params.taskId

// 所有批量任务 ID
const batchTaskIds = ref([primaryTaskId])

// 当前查看的任务 ID
const currentTaskId = ref(primaryTaskId)

// 各任务结果缓存 { taskId: result }
const taskResults = ref({})
// 各任务状态缓存 { taskId: { status, step, stepStatus } }
const taskStatuses = ref({})

// 当前任务加载状态
const loading = ref(true)

// 当前高亮的 bbox 索引（-1 = 无）
const highlightedBoxIndex = ref(-1)

let pollingTimer = null

// ---- 当前任务的计算属性 ----
const result = computed(() => taskResults.value[currentTaskId.value] || null)
const imageUrl = computed(() => result.value?.imageUrl || '')

const currentStep = computed(() => {
  const s = taskStatuses.value[currentTaskId.value]
  if (!s) return 1
  if (s.status === 'uploading') return 0
  if (s.status === 'detecting') return 1
  return 2
})

const stepStatus = computed(() => {
  const s = taskStatuses.value[currentTaskId.value]
  if (!s) return 'process'
  if (s.status === 'completed') return 'finish'
  if (s.status === 'failed') return 'error'
  return 'process'
})

// ---- 切换器辅助 ----
const getTaskStatusColor = (tid) => {
  const s = taskStatuses.value[tid]?.status
  if (s === 'completed') return 'success'
  if (s === 'failed') return 'error'
  return 'processing'
}

const getTaskStatusText = (tid) => {
  const s = taskStatuses.value[tid]?.status
  const map = { uploading: '上传中', detecting: '检测中', completed: '已完成', failed: '失败' }
  return map[s] || '检测中'
}

// ---- 轮询逻辑 ----
const stopPolling = () => {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
}

const pollOnce = async (taskId) => {
  try {
    const status = await getTaskStatus(taskId)
    taskStatuses.value[taskId] = { status: status.status }

    if (status.status === 'completed') {
      // 只有当前任务停止轮询
      if (taskId === currentTaskId.value) stopPolling()
      if (!taskResults.value[taskId]) {
        const res = await getTaskResult(taskId)
        taskResults.value[taskId] = res
      }
      if (taskId === currentTaskId.value) loading.value = false
    } else if (status.status === 'failed') {
      if (taskId === currentTaskId.value) {
        stopPolling()
        loading.value = false
        message.error('检测失败')
      }
    }
  } catch (e) {
    console.error('轮询出错', e)
    // 如果是 404（任务不存在），停止轮询并提示
    if (e?.response?.status === 404 && taskId === currentTaskId.value) {
      stopPolling()
      loading.value = false
      message.error('任务不存在，请重新上传图片检测')
    }
  }
}

const startPolling = (taskId) => {
  stopPolling()
  if (taskResults.value[taskId]) {
    loading.value = false
    return
  }
  loading.value = true
  pollOnce(taskId)
  pollingTimer = setInterval(() => pollOnce(taskId), 2000)
}

// ---- 切换任务 ----
const switchTask = (taskId) => {
  if (taskId === currentTaskId.value) return
  currentTaskId.value = taskId
  highlightedBoxIndex.value = -1
  startPolling(taskId)
}

// ---- bbox 交互 ----
const onBoxClick = (index) => {
  highlightedBoxIndex.value = highlightedBoxIndex.value === index ? -1 : index
}

// 拖拽结束后更新坐标，坐标面板同步刷新
const onBoxMove = (index, newCoords) => {
  const res = taskResults.value[currentTaskId.value]
  if (res && res.boxes && res.boxes[index]) {
    res.boxes[index] = { ...res.boxes[index], ...newCoords }
    taskResults.value[currentTaskId.value] = { ...res }
  }
}

// 调整大小结束后更新坐标，坐标面板同步刷新
const onBoxResize = (index, newCoords) => {
  const res = taskResults.value[currentTaskId.value]
  if (res && res.boxes && res.boxes[index]) {
    res.boxes[index] = { ...res.boxes[index], ...newCoords }
    taskResults.value[currentTaskId.value] = { ...res }
  }
}

// 根据 box.result 返回颜色状态：red=篡改, yellow=可疑, green=正常
const getBoxStatus = (box) => {
  const r = box.result || ''
  if (r === '篡改' || r.includes('篡改')) return 'red'
  if (r === '可疑' || r.includes('可疑') || r.includes('疑似')) return 'yellow'
  return 'green'
}

// ---- 其他工具函数 ----
const getScoreColor = (score) => {
  if (score >= 80) return '#52c41a'
  if (score >= 60) return '#faad14'
  return '#ff4d4f'
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const downloadReport = () => {
  message.info('报告下载功能开发中')
}

// ---- 生命周期 ----
onMounted(() => {
  // 解析批量 taskId
  const batchParam = route.query.batch
  if (batchParam) {
    const others = batchParam.split(',').filter(Boolean)
    batchTaskIds.value = [primaryTaskId, ...others]
    // 初始化其他任务状态
    others.forEach(tid => {
      taskStatuses.value[tid] = { status: 'detecting' }
      // 后台静默预取
      pollOnce(tid)
    })
  }

  // 开始轮询当前任务
  startPolling(primaryTaskId)
})

onUnmounted(() => stopPolling())
</script>

<style scoped>
.result-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 批量切换器 */
.batch-switcher-card {
  overflow-x: auto;
}

.batch-switcher {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  overflow-x: auto;
}

.batch-thumb-item {
  flex: 0 0 110px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  background: #fafafa;
}

.batch-thumb-item:hover {
  border-color: #1890ff;
}

.batch-thumb-item.active {
  border-color: #1890ff;
  background: #e6f4ff;
}

.batch-thumb-image {
  width: 100%;
  height: 72px;
  overflow: hidden;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.batch-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.batch-thumb-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #bbb;
  font-size: 12px;
}

.batch-thumb-placeholder .anticon {
  font-size: 22px;
}

.batch-thumb-footer {
  padding: 6px 6px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.batch-thumb-no {
  font-size: 12px;
  color: #555;
  white-space: nowrap;
}

/* 主内容 */
.progress-card { padding: 8px 0; }

.content-area {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 1200px) {
  .content-area { grid-template-columns: 1fr; }
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-card { height: fit-content; }

.image-container {
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
  margin-bottom: 12px;
  display: block;
}

/* bbox 坐标面板 */
.bbox-hint {
  font-size: 12px;
  color: #999;
  font-weight: normal;
  margin-left: 8px;
}

.bbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

/* 颜色图例 */
.bbox-card-title {
  margin-right: 8px;
}

.bbox-legend {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 4px;
}

.bbox-legend-red { background: #ff4d4f; }
.bbox-legend-yellow { background: #faad14; }
.bbox-legend-green { background: #52c41a; }

/* 不同状态的颜色 */
.bbox-item-red { border-left: 3px solid #ff4d4f; }
.bbox-item-yellow { border-left: 3px solid #faad14; }
.bbox-item-green { border-left: 3px solid #52c41a; }

.bbox-item:hover {
  background: #fafafa;
}

.bbox-item-active {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}

.bbox-item-active.bbox-item-red { background: #fff1f0; border-color: #ffa39e; }
.bbox-item-active.bbox-item-yellow { background: #fffbe6; border-color: #ffd591; }
.bbox-item-active.bbox-item-green { background: #f6ffed; border-color: #b7eb8f; }

.bbox-index {
  flex: 0 0 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bbox-index-red { background: #ff4d4f; }
.bbox-index-yellow { background: #faad14; }
.bbox-index-green { background: #52c41a; }

.bbox-item-active .bbox-index-red { background: #cf1322; }
.bbox-item-active .bbox-index-yellow { background: #d48806; }
.bbox-item-active .bbox-index-green { background: #389e0d; }

.bbox-content {
  flex: 1;
  min-width: 0;
}

.bbox-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.bbox-label-text {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.bbox-coords-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.coord-code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #d46b08;
  background: #fff7e6;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #ffd591;
}

.coord-size {
  font-size: 11px;
  color: #999;
}

.bbox-arrow {
  flex: 0 0 20px;
  font-size: 16px;
}

/* 报告 */
.report-card { height: fit-content; }

.conclusion-alert { margin-bottom: 20px; }

.score-section,
.detail-section,
.meta-section { margin-bottom: 20px; }

.score-section h4,
.detail-section h4 {
  margin-bottom: 12px;
  color: var(--text-color);
}

/* 底部 */
.action-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 12px 0;
}
</style>
