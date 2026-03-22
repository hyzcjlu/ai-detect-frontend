<template>
  <div class="review-page">
    <!-- 筛选栏 -->
    <a-card class="filter-card">
      <a-space wrap>
        <a-range-picker 
          v-model:value="filters.dateRange"
          :placeholder="['开始日期', '结束日期']"
          @change="handleFilter"
        />
        
        <a-select
          v-model:value="filters.reviewStatus"
          placeholder="复核状态"
          style="width: 120px"
          allow-clear
          @change="handleFilter"
        >
          <a-select-option value="pending">待复核</a-select-option>
          <a-select-option value="confirmed">已确认篡改</a-select-option>
          <a-select-option value="misjudged">误判</a-select-option>
          <a-select-option value="uncertain">存疑</a-select-option>
        </a-select>
        
        <a-select
          v-model:value="filters.operator"
          placeholder="操作人"
          style="width: 140px"
          allow-clear
          @change="handleFilter"
        >
          <a-select-option v-for="op in operators" :key="op" :value="op">
            {{ op }}
          </a-select-option>
        </a-select>
        
        <a-button @click="resetFilters">
          <ReloadOutlined /> 重置
        </a-button>
      </a-space>
    </a-card>
    
    <div class="content-area">
      <!-- 待复核列表 -->
      <a-card class="list-card" title="待复核任务">
        <template #extra>
          <a-tag color="warning">{{ pendingCount }} 条待处理</a-tag>
        </template>
        
        <a-spin :spinning="loading">
          <a-list 
            :data-source="reviewList" 
            :pagination="pagination"
            @change="handlePageChange"
          >
            <template #renderItem="{ item }">
              <a-list-item 
                :class="{ 'list-item-active': selectedTask?.taskId === item.taskId }"
                @click="selectTask(item)"
              >
                <a-list-item-meta>
                  <template #avatar>
                    <a-badge 
                      :status="getReviewStatusBadge(item.reviewStatus)" 
                      :offset="[-5, 40]"
                    >
                      <a-avatar :src="item.thumbnail" shape="square" :size="56" />
                    </a-badge>
                  </template>
                  <template #title>
                    <div class="item-title">
                      <span>{{ item.fileName }}</span>
                      <a-tag :color="getResultColor(item.isTampered)">
                        {{ item.isTampered ? '疑似篡改' : '可疑' }}
                      </a-tag>
                    </div>
                  </template>
                  <template #description>
                    <div class="item-desc">
                      <span><ClockCircleOutlined /> {{ formatTime(item.createdAt) }}</span>
                      <span><UserOutlined /> {{ item.operator || '系统' }}</span>
                    </div>
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <a-tag :color="getReviewStatusColor(item.reviewStatus)">
                    {{ getReviewStatusText(item.reviewStatus) }}
                  </a-tag>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-spin>
      </a-card>
      
      <!-- 复核详情面板 -->
      <a-card class="detail-card" title="复核详情">
        <template v-if="selectedTask">
          <!-- 图片标注展示 -->
          <div class="image-section">
            <ImageAnnotation
              :src="selectedTask.imageUrl"
              :boxes="selectedTask.boxes"
              alt="待复核图片"
            />
          </div>
          
          <!-- AI 检测结果 -->
          <a-divider>AI 检测结果</a-divider>
          <div class="ai-result">
            <a-descriptions :column="2" size="small">
              <a-descriptions-item label="检测结论">
                <a-tag :color="selectedTask.isTampered ? 'error' : 'warning'">
                  {{ selectedTask.isTampered ? '疑似篡改' : '可疑' }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="置信度">
                <a-progress 
                  :percent="selectedTask.confidenceScore" 
                  :size="'small'"
                  :stroke-color="getScoreColor(selectedTask.confidenceScore)"
                />
              </a-descriptions-item>
            </a-descriptions>
            
            <div class="ai-details">
              <h4>检测详情</h4>
              <a-list :data-source="selectedTask.details" size="small">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <WarningOutlined v-if="item.type === 'warning'" style="color: #faad14; margin-right: 8px;" />
                    <InfoCircleOutlined v-else style="color: #1890ff; margin-right: 8px;" />
                    <span><strong>{{ item.title }}：</strong>{{ item.description }}</span>
                  </a-list-item>
                </template>
              </a-list>
            </div>
          </div>
          
          <!-- 人工复核操作 -->
          <a-divider>人工复核</a-divider>
          <div class="review-actions">
            <a-textarea
              v-model:value="reviewNote"
              placeholder="请输入复核备注（可选）"
              :rows="2"
              class="review-note"
            />
            
            <div class="review-buttons">
              <a-button 
                type="primary" 
                danger
                :loading="submitting"
                @click="submitReview('confirmed')"
              >
                <CheckCircleOutlined /> 确认篡改
              </a-button>
              <a-button 
                type="primary"
                :loading="submitting"
                @click="submitReview('misjudged')"
              >
                <CloseCircleOutlined /> 标记误判
              </a-button>
              <a-button 
                :loading="submitting"
                @click="submitReview('uncertain')"
              >
                <QuestionCircleOutlined /> 存疑
              </a-button>
            </div>
          </div>
          
          <!-- 复核历史 -->
          <div v-if="selectedTask.reviewHistory?.length" class="review-history">
            <a-divider>复核历史</a-divider>
            <a-timeline>
              <a-timeline-item 
                v-for="(history, index) in selectedTask.reviewHistory" 
                :key="index"
                :color="getReviewStatusColor(history.status)"
              >
                <p><strong>{{ history.reviewer }}</strong> {{ getReviewStatusText(history.status) }}</p>
                <p class="history-time">{{ formatTime(history.time) }}</p>
                <p v-if="history.note" class="history-note">备注：{{ history.note }}</p>
              </a-timeline-item>
            </a-timeline>
          </div>
        </template>
        
        <a-empty v-else description="请从左侧列表选择一条记录进行复核" />
      </a-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import ImageAnnotation from '@/components/ImageAnnotation.vue'
import { getReviewList, submitReviewResult, getOperators } from '@/api/detection'

const loading = ref(false)
const submitting = ref(false)
const reviewList = ref([])
const selectedTask = ref(null)
const reviewNote = ref('')
const operators = ref([])

const filters = reactive({
  dateRange: null,
  reviewStatus: null,
  operator: null
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`
})

// 待处理数量
const pendingCount = computed(() => {
  return reviewList.value.filter(r => r.reviewStatus === 'pending').length
})

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      reviewStatus: filters.reviewStatus,
      operator: filters.operator,
      startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD')
    }
    const res = await getReviewList(params)
    reviewList.value = res.list
    pagination.total = res.total
  } catch (error) {
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 获取操作人列表
const fetchOperators = async () => {
  try {
    operators.value = await getOperators()
  } catch (error) {
    console.error('获取操作人列表失败', error)
  }
}

// 选择任务
const selectTask = (task) => {
  selectedTask.value = task
  reviewNote.value = ''
}

// 提交复核结果
const submitReview = async (status) => {
  if (!selectedTask.value) return
  
  submitting.value = true
  try {
    await submitReviewResult(selectedTask.value.taskId, {
      status,
      note: reviewNote.value,
      reviewer: '当前用户' // 实际应从登录状态获取
    })
    
    message.success('复核结果已提交')
    
    // 更新列表中的状态
    selectedTask.value.reviewStatus = status
    selectedTask.value.reviewHistory = selectedTask.value.reviewHistory || []
    selectedTask.value.reviewHistory.unshift({
      status,
      note: reviewNote.value,
      reviewer: '当前用户',
      time: Date.now()
    })
    
    reviewNote.value = ''
    
    // 自动选择下一条待复核
    const nextPending = reviewList.value.find(
      r => r.reviewStatus === 'pending' && r.taskId !== selectedTask.value.taskId
    )
    if (nextPending) {
      selectTask(nextPending)
    }
  } catch (error) {
    message.error('提交失败：' + (error.message || '未知错误'))
  } finally {
    submitting.value = false
  }
}

// 筛选
const handleFilter = () => {
  pagination.current = 1
  fetchData()
}

// 重置筛选
const resetFilters = () => {
  filters.dateRange = null
  filters.reviewStatus = null
  filters.operator = null
  pagination.current = 1
  fetchData()
}

// 翻页
const handlePageChange = (pag) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchData()
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 获取结果颜色
const getResultColor = (isTampered) => {
  return isTampered ? 'error' : 'warning'
}

// 获取评分颜色
const getScoreColor = (score) => {
  if (score >= 80) return '#52c41a'
  if (score >= 60) return '#faad14'
  return '#ff4d4f'
}

// 复核状态相关
const getReviewStatusColor = (status) => {
  const colors = {
    pending: 'default',
    confirmed: 'error',
    misjudged: 'success',
    uncertain: 'warning'
  }
  return colors[status] || 'default'
}

const getReviewStatusText = (status) => {
  const texts = {
    pending: '待复核',
    confirmed: '确认篡改',
    misjudged: '误判',
    uncertain: '存疑'
  }
  return texts[status] || status
}

const getReviewStatusBadge = (status) => {
  const badges = {
    pending: 'warning',
    confirmed: 'error',
    misjudged: 'success',
    uncertain: 'default'
  }
  return badges[status] || 'default'
}

onMounted(() => {
  fetchData()
  fetchOperators()
})
</script>

<style scoped>
.review-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding: 8px 0;
}

.content-area {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 16px;
  min-height: 600px;
}

@media (max-width: 1200px) {
  .content-area {
    grid-template-columns: 1fr;
  }
}

.list-card {
  height: fit-content;
  max-height: calc(100vh - 200px);
  overflow: hidden;
}

.list-card :deep(.ant-card-body) {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.list-item-active {
  background: #e6f7ff;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-desc {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #999;
}

.item-desc span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-card {
  height: fit-content;
}

.image-section {
  text-align: center;
  margin-bottom: 16px;
}

.ai-result {
  margin-bottom: 16px;
}

.ai-details {
  margin-top: 16px;
}

.ai-details h4 {
  margin-bottom: 8px;
  color: var(--text-color);
}

.review-actions {
  margin-top: 16px;
}

.review-note {
  margin-bottom: 16px;
}

.review-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.review-history {
  margin-top: 16px;
}

.history-time {
  font-size: 12px;
  color: #999;
}

.history-note {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}
</style>
