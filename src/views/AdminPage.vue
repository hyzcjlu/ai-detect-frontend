<template>
  <div class="admin-page">
    <!-- Tab 切换 -->
    <a-tabs v-model:activeKey="activeTab" class="admin-tabs">
      <!-- 检测记录查询 -->
      <a-tab-pane key="records" tab="检测记录">
        <a-card>
          <template #extra>
            <a-button type="primary" @click="$router.push('/')">
              <PlusOutlined /> 新建检测
            </a-button>
          </template>
          
          <!-- 筛选栏 -->
          <div class="filter-bar">
            <a-space wrap>
              <a-range-picker 
                v-model:value="filters.dateRange"
                :placeholder="['开始日期', '结束日期']"
                @change="handleFilter"
              />
              
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
              
              <a-select
                v-model:value="filters.status"
                placeholder="状态筛选"
                style="width: 120px"
                allow-clear
                @change="handleFilter"
              >
                <a-select-option value="completed">已完成</a-select-option>
                <a-select-option value="detecting">检测中</a-select-option>
                <a-select-option value="failed">失败</a-select-option>
              </a-select>
              
              <a-select
                v-model:value="filters.result"
                placeholder="结果类型"
                style="width: 140px"
                allow-clear
                @change="handleFilter"
              >
                <a-select-option value="tampered">疑似篡改</a-select-option>
                <a-select-option value="normal">正常</a-select-option>
              </a-select>
              
              <a-input-search
                v-model:value="filters.keyword"
                placeholder="搜索文件名"
                style="width: 200px"
                @search="handleFilter"
              />
              
              <a-button @click="resetFilters">
                <ReloadOutlined /> 重置
              </a-button>
            </a-space>
          </div>
          
          <!-- 数据表格 -->
          <a-table
            :columns="columns"
            :data-source="records"
            :loading="loading"
            :pagination="pagination"
            :row-key="record => record.taskId"
            @change="handleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'thumbnail'">
                <a-image
                  :src="record.thumbnail"
                  :width="60"
                  :height="60"
                  style="object-fit: cover; border-radius: 4px;"
                />
              </template>
              
              <template v-else-if="column.key === 'operator'">
                {{ record.operator || '系统' }}
              </template>
              
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusText(record.status) }}
                </a-tag>
              </template>
              
              <template v-else-if="column.key === 'result'">
                <template v-if="record.status === 'completed'">
                  <a-tag v-if="record.isTampered" color="error">
                    <WarningOutlined /> 疑似篡改
                  </a-tag>
                  <a-tag v-else color="success">
                    <CheckCircleOutlined /> 正常
                  </a-tag>
                </template>
                <span v-else class="text-muted">-</span>
              </template>
              
              <template v-else-if="column.key === 'confidenceScore'">
                <template v-if="record.status === 'completed'">
                  <a-progress 
                    :percent="record.confidenceScore" 
                    :size="'small'"
                    :stroke-color="getScoreColor(record.confidenceScore)"
                    :show-info="true"
                  />
                </template>
                <span v-else class="text-muted">-</span>
              </template>
              
              <template v-else-if="column.key === 'createdAt'">
                {{ formatTime(record.createdAt) }}
              </template>
              
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button 
                    type="link" 
                    size="small"
                    :disabled="record.status !== 'completed'"
                    @click="viewResult(record.taskId)"
                  >
                    <EyeOutlined /> 查看
                  </a-button>
                  <a-popconfirm
                    title="确定删除该记录吗？"
                    @confirm="deleteRecord(record.taskId)"
                  >
                    <a-button type="link" size="small" danger>
                      <DeleteOutlined /> 删除
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
      
      <!-- 样本抽查 -->
      <a-tab-pane key="sampling" tab="样本抽查">
        <a-card>
          <template #title>
            <span>样本抽查界面</span>
          </template>
          <template #extra>
            <a-space>
              <a-select v-model:value="samplingRate" style="width: 120px">
                <a-select-option :value="5">5% 抽样</a-select-option>
                <a-select-option :value="10">10% 抽样</a-select-option>
                <a-select-option :value="20">20% 抽样</a-select-option>
              </a-select>
              <a-button type="primary" @click="generateSamples" :loading="samplingLoading">
                <ExperimentOutlined /> 生成抽样
              </a-button>
            </a-space>
          </template>
          
          <a-alert 
            v-if="sampledRecords.length > 0"
            :message="`已抽取 ${sampledRecords.length} 条样本（${samplingRate}% 比例）`"
            type="info"
            show-icon
            class="sampling-alert"
          />
          
          <a-table
            :columns="samplingColumns"
            :data-source="sampledRecords"
            :loading="samplingLoading"
            :row-key="record => record.taskId"
            :pagination="{ pageSize: 10 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'thumbnail'">
                <a-image
                  :src="record.thumbnail"
                  :width="60"
                  :height="60"
                  style="object-fit: cover; border-radius: 4px;"
                />
              </template>
              
              <template v-else-if="column.key === 'aiResult'">
                <a-tag :color="record.isTampered ? 'error' : 'success'">
                  {{ record.isTampered ? '疑似篡改' : '正常' }}
                </a-tag>
              </template>
              
              <template v-else-if="column.key === 'manualLabel'">
                <a-select 
                  v-model:value="record.manualLabel" 
                  style="width: 120px"
                  placeholder="人工标注"
                  @change="saveSampleLabel(record)"
                >
                  <a-select-option value="correct">AI正确</a-select-option>
                  <a-select-option value="wrong">AI错误</a-select-option>
                  <a-select-option value="uncertain">无法判断</a-select-option>
                </a-select>
              </template>
              
              <template v-else-if="column.key === 'actions'">
                <a-button type="link" size="small" @click="viewResult(record.taskId)">
                  <EyeOutlined /> 详情
                </a-button>
              </template>
            </template>
          </a-table>
          
          <div v-if="sampledRecords.length > 0" class="sampling-summary">
            <a-statistic-countdown title="抽查进度" :value="Date.now() + 1000" format="已标注 " />
            <a-progress 
              :percent="Math.round((labeledCount / sampledRecords.length) * 100)"
              :format="() => `${labeledCount}/${sampledRecords.length}`"
            />
          </div>
        </a-card>
      </a-tab-pane>
      
      <!-- 统计报表 -->
      <a-tab-pane key="statistics" tab="统计报表">
        <div class="stats-grid">
          <!-- 关键指标卡片 -->
          <a-card class="stat-card">
            <a-statistic title="总检测数" :value="stats.total">
              <template #prefix><DatabaseOutlined /></template>
            </a-statistic>
          </a-card>
          <a-card class="stat-card">
            <a-statistic title="疑似篡改" :value="stats.tampered" value-style="color: #ff4d4f">
              <template #prefix><WarningOutlined /></template>
            </a-statistic>
          </a-card>
          <a-card class="stat-card">
            <a-statistic title="正常图片" :value="stats.normal" value-style="color: #52c41a">
              <template #prefix><CheckCircleOutlined /></template>
            </a-statistic>
          </a-card>
          <a-card class="stat-card">
            <a-statistic title="疑似篡改率" :value="stats.tamperedRate" suffix="%">
              <template #prefix><LineChartOutlined /></template>
            </a-statistic>
          </a-card>
        </div>
        
        <!-- 检测结果分布 -->
        <a-row :gutter="16" class="chart-row">
          <a-col :span="12">
            <a-card title="检测结果分布">
              <div class="chart-placeholder">
                <a-progress 
                  type="circle" 
                  :percent="stats.tamperedRate" 
                  :stroke-color="{ '0%': '#ff4d4f', '100%': '#faad14' }"
                  :format="() => `篡改 ${stats.tampered}`"
                />
                <div class="chart-legend">
                  <div><a-badge color="#ff4d4f" /> 疑似篡改: {{ stats.tampered }} ({{ stats.tamperedRate }}%)</div>
                  <div><a-badge color="#52c41a" /> 正常: {{ stats.normal }} ({{ 100 - stats.tamperedRate }}%)</div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card title="复核状态分布">
              <div class="chart-placeholder">
                <a-progress 
                  type="dashboard" 
                  :percent="stats.reviewedRate"
                  :format="() => `已复核 ${stats.reviewedRate}%`"
                />
                <div class="chart-legend">
                  <div><a-badge color="#52c41a" /> 确认篡改: {{ stats.confirmed }}</div>
                  <div><a-badge color="#1890ff" /> 误判: {{ stats.misjudged }}</div>
                  <div><a-badge color="#faad14" /> 存疑: {{ stats.uncertain }}</div>
                  <div><a-badge color="#d9d9d9" /> 待复核: {{ stats.pendingReview }}</div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>
        
        <!-- 趋势图（简化版） -->
        <a-card title="近7日检测趋势" class="trend-card">
          <div class="trend-chart">
            <div 
              v-for="(day, index) in stats.weeklyTrend" 
              :key="index"
              class="trend-bar"
            >
              <div 
                class="trend-bar-fill"
                :style="{ height: `${(day.count / stats.maxDaily) * 100}%` }"
              >
                <span class="trend-bar-value">{{ day.count }}</span>
              </div>
              <span class="trend-bar-label">{{ day.date }}</span>
            </div>
          </div>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  PictureOutlined,
  DatabaseOutlined,
  LineChartOutlined
} from '@ant-design/icons-vue'
import { getRecordList, deleteRecordById, getStats, getOperators, getSampledRecords, saveSampleLabelApi } from '@/api/detection'

const router = useRouter()

const activeTab = ref('records')
const loading = ref(false)
const records = ref([])
const operators = ref([])

// 抽样相关
const samplingLoading = ref(false)
const samplingRate = ref(10)
const sampledRecords = ref([])

// 统计数据
const stats = ref({
  total: 0,
  tampered: 0,
  normal: 0,
  tamperedRate: 0,
  accuracy: 0,
  falsePositiveRate: 0,
  dailyAverage: 0,
  confirmed: 0,
  misjudged: 0,
  uncertain: 0,
  pendingReview: 0,
  reviewedRate: 0,
  weeklyTrend: [],
  maxDaily: 100
})

const filters = reactive({
  dateRange: null,
  status: null,
  result: null,
  keyword: '',
  operator: null
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total) => `共 ${total} 条记录`
})

const columns = [
  { title: '缩略图', key: 'thumbnail', width: 80 },
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
  { title: '操作人', key: 'operator', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '检测结果', key: 'result', width: 120 },
  { title: '可信度', key: 'confidenceScore', width: 150 },
  { title: '检测时间', key: 'createdAt', width: 180, sorter: true },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' }
]

const samplingColumns = [
  { title: '缩略图', key: 'thumbnail', width: 80 },
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
  { title: 'AI结果', key: 'aiResult', width: 120 },
  { title: '人工标注', key: 'manualLabel', width: 140 },
  { title: '操作', key: 'actions', width: 100 }
]

// 已标注数量
const labeledCount = computed(() => {
  return sampledRecords.value.filter(r => r.manualLabel).length
})

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      ...filters,
      startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD')
    }
    const res = await getRecordList(params)
    records.value = res.list
    pagination.total = res.total
  } catch (error) {
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 获取统计数据
const fetchStats = async () => {
  try {
    stats.value = await getStats()
  } catch (error) {
    console.error('获取统计失败', error)
  }
}

// 获取操作人
const fetchOperators = async () => {
  try {
    operators.value = await getOperators()
  } catch (error) {
    console.error('获取操作人列表失败', error)
  }
}

// 表格变化
const handleTableChange = (pag) => {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchData()
}

// 筛选
const handleFilter = () => {
  pagination.current = 1
  fetchData()
}

// 重置筛选
const resetFilters = () => {
  filters.dateRange = null
  filters.status = null
  filters.result = null
  filters.keyword = ''
  filters.operator = null
  pagination.current = 1
  fetchData()
}

// 查看结果
const viewResult = (taskId) => {
  router.push(`/result/${taskId}`)
}

// 删除记录
const deleteRecord = async (taskId) => {
  try {
    await deleteRecordById(taskId)
    message.success('删除成功')
    fetchData()
    fetchStats()
  } catch (error) {
    message.error('删除失败')
  }
}

// 生成抽样
const generateSamples = async () => {
  samplingLoading.value = true
  try {
    sampledRecords.value = await getSampledRecords(samplingRate.value)
    message.success(`已生成 ${sampledRecords.value.length} 条抽样记录`)
  } catch (error) {
    message.error('生成抽样失败')
  } finally {
    samplingLoading.value = false
  }
}

// 保存样本标注
const saveSampleLabel = async (record) => {
  try {
    await saveSampleLabelApi(record.taskId, record.manualLabel)
    message.success('标注已保存')
  } catch (error) {
    message.error('保存失败')
  }
}

// 状态颜色
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

// 状态文字
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

// 评分颜色
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

onMounted(() => {
  fetchData()
  fetchStats()
  fetchOperators()
})
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-tabs :deep(.ant-tabs-content) {
  min-height: 500px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.text-muted {
  color: #999;
}

/* 抽样页面 */
.sampling-alert {
  margin-bottom: 16px;
}

.sampling-summary {
  margin-top: 24px;
  text-align: center;
}

/* 统计页面 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 992px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  text-align: center;
}

.chart-row {
  margin-bottom: 16px;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  gap: 24px;
}

.chart-legend {
  text-align: left;
}

.chart-legend > div {
  margin: 8px 0;
}

/* 趋势图 */
.trend-card {
  margin-top: 16px;
}

.trend-chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 200px;
  padding: 20px;
}

.trend-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 60px;
}

.trend-bar-fill {
  width: 40px;
  background: linear-gradient(180deg, #1890ff 0%, #69c0ff 100%);
  border-radius: 4px 4px 0 0;
  min-height: 20px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transition: height 0.3s;
}

.trend-bar-value {
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  padding-top: 4px;
}

.trend-bar-label {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}
</style>
