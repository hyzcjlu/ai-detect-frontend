import axios from 'axios'
import { useMock } from './mock'

// ===== 配置 =====
// true = 使用 Mock 数据（后端未启动时）
// false = 使用真实后端 API
const USE_MOCK = false

const api = axios.create({
  baseURL: '/api/v3',
  timeout: 60000 // 检测可能较慢
})

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 本地图片预览缓存：taskId → blobURL（上传时存储，用于前端显示原图）
const localImageCache = {}
// 本地文件名缓存：taskId → 原始文件名
const localFileNameCache = {}

// 后端状态枚举 → 前端状态映射
const STATUS_MAP = {
  UPLOADED: 'uploading',
  PENDING: 'uploading',
  PROCESSING: 'detecting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'failed'
}

// ===== 核心检测 API =====

/**
 * 上传图片提交检测任务
 * @param {File} file - 图片文件
 * @param {Array} [bbox] - 可选指定检测区域 [x1, y1, x2, y2]
 */
export async function uploadImage(file, bbox) {
  if (USE_MOCK) return useMock.uploadImage(file)

  const formData = new FormData()
  formData.append('file', file)
  if (bbox) {
    formData.append('bbox', JSON.stringify(bbox))
  }

  const res = await api.post('/detect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

  const taskId = res.task_id
  // 缓存原图 Blob URL 和原始文件名
  localImageCache[taskId] = URL.createObjectURL(file)
  localFileNameCache[taskId] = file.name

  return { taskId, message: '上传成功' }
}

/**
 * 获取任务状态（轮询用）
 */
export async function getTaskStatus(taskId) {
  if (USE_MOCK) return useMock.getTaskStatus(taskId)

  const task = await api.get(`/result/${taskId}`)
  const status = STATUS_MAP[task.status] || 'detecting'

  let progress = 0
  if (status === 'uploading') progress = 20
  else if (status === 'detecting') progress = 50
  else if (status === 'completed') progress = 100
  else if (status === 'failed') progress = 100

  return { status, progress }
}

/**
 * 获取检测结果，映射为前端所需格式
 */
export async function getTaskResult(taskId) {
  if (USE_MOCK) return useMock.getTaskResult(taskId)

  const task = await api.get(`/result/${taskId}`)
  if (task.status !== 'COMPLETED') {
    throw new Error('任务尚未完成')
  }

  // 收集所有检测区域
  const boxes = []
  const details = []
  let isTampered = false
  let maxConfidence = 0

  // multi_results 用于全图多框扫描，result 用于单框检测
  const resultItems = task.multi_results || (task.result ? [task.result] : [])

  for (const item of resultItems) {
    // 解析 bbox：优先 original_bbox [x1,y1,x2,y2]，否则用 bbox [x,y,w,h]
    const raw = item.original_bbox || item.bbox
    if (raw && raw.length === 4) {
      let x1, y1, x2, y2
      if (item.original_bbox) {
        [x1, y1, x2, y2] = raw
      } else {
        // engine 返回的是 [x, y, w, h]
        x1 = raw[0]; y1 = raw[1]
        x2 = raw[0] + raw[2]; y2 = raw[1] + raw[3]
      }

      const labelMap = { '篡改': '篡改区域', '可疑': '可疑区域', '正常': '正常区域' }
      boxes.push({
        x1, y1, x2, y2,
        label: labelMap[item.result] || item.result || '检测区域',
        confidence: item.confidence || 0,
        result: item.result || '正常'
      })
    }

    if (item.result === '篡改' || item.result === '可疑') {
      isTampered = true
    }
    maxConfidence = Math.max(maxConfidence, item.confidence || 0)

    // 解析 reason（以 ；分号分隔）为详细分析列表
    if (item.reason) {
      const reasons = item.reason.split('；').filter(Boolean)
      for (const r of reasons) {
        const isWarning = /异常|拼接|涂抹|篡改|风险/.test(r)
        details.push({
          type: isWarning ? 'warning' : 'info',
          title: item.result === '篡改' ? '高风险' : item.result === '可疑' ? '中风险' : '低风险',
          description: r
        })
      }
    }
  }

  // 可信度评分（100 - 最高风险值百分比），值越高越可信
  const confidenceScore = Math.round((1 - maxConfidence) * 100)

  // 原图URL：优先用本地 Blob 缓存，否则用后端可视化接口
  const imageUrl = localImageCache[taskId] || `/api/v3/result/${taskId}/visualization`

  return {
    taskId,
    fileName: localFileNameCache[taskId] || `检测图片_${taskId.substring(0, 8)}`,
    thumbnail: imageUrl,
    imageUrl,
    status: 'completed',
    isTampered,
    confidenceScore,
    createdAt: task.created_at ? new Date(task.created_at).getTime() : Date.now(),
    completedAt: Date.now(),
    imageSize: '-',
    processingTime: '-',
    boxes,
    details: details.length > 0
      ? details
      : [{ type: 'info', title: '分析完成', description: isTampered ? '检测到疑似篡改痕迹' : '未发现明显篡改痕迹' }]
  }
}

/**
 * 使用新 bbox 重新提交检测（用户手动调整区域后）
 * @param {string} taskId - 已有任务 ID
 * @param {Array} bbox - 新区域 [x1, y1, x2, y2]
 */
export async function redetectWithBbox(taskId, bbox) {
  if (USE_MOCK) return { taskId, message: 'Mock 模式不支持重新检测' }

  const formData = new FormData()
  formData.append('task_id', taskId)
  formData.append('bbox', JSON.stringify(bbox))

  const res = await api.post('/detect', formData)
  return { taskId: res.task_id, message: '重新检测已提交' }
}

// ===== 后台管理 API =====

export async function getRecentRecords() {
  if (USE_MOCK) return useMock.getRecentRecords()
  try {
    const res = await getRecordList({ page: 1, pageSize: 5 })
    return res.list || []
  } catch (e) {
    return useMock.getRecentRecords()
  }
}

export async function getRecordList(params = {}) {
  if (USE_MOCK) return useMock.getRecordList(params)
  
  try {
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const res = await api.get(`/history?page=${page}&size=${pageSize}`)
    
    const list = res.items.map(task => {
      const resultItems = task.multi_results || (task.result ? [task.result] : [])
      let isTampered = false
      let maxConfidence = 0
      
      for (const item of resultItems) {
        if (item.result === '篡改' || item.result === '可疑') isTampered = true
        maxConfidence = Math.max(maxConfidence, item.confidence || 0)
      }
      
      const status = STATUS_MAP[task.status] || 'detecting'
      const imageUrl = localImageCache[task.task_id] || `/api/v3/result/${task.task_id}/visualization`
      
      return {
        taskId: task.task_id,
        fileName: localFileNameCache[task.task_id] || `检测图片_${task.task_id.substring(0, 8)}`,
        thumbnail: imageUrl,
        status,
        isTampered,
        confidenceScore: maxConfidence > 0 ? Math.round((1 - maxConfidence) * 100) : '-',
        createdAt: task.created_at ? new Date(task.created_at).getTime() : Date.now(),
        operator: '系统'
      }
    })
    
    return { list, total: res.total }
  } catch (e) {
    console.error('获取记录列表失败', e)
    return useMock.getRecordList(params)
  }
}

export async function deleteRecordById(taskId) {
  if (USE_MOCK) return useMock.deleteRecord(taskId)
  try {
    return await api.delete(`/task/${taskId}`)
  } catch {
    return useMock.deleteRecord(taskId)
  }
}

export async function getStats() {
  if (USE_MOCK) return useMock.getStats()
  try {
    const res = await api.get('/history?page=1&size=100')
    const tasks = res.items
    const completed = tasks.filter(t => t.status === 'COMPLETED')
    let tampered = 0
    let normal = 0
    for (const task of completed) {
      const items = task.multi_results || (task.result ? [task.result] : [])
      const hasTamper = items.some(i => i.result === '篡改' || i.result === '可疑')
      if (hasTamper) tampered++
      else normal++
    }
    const total = completed.length
    const tamperedRate = total > 0 ? Math.round((tampered / total) * 100) : 0
    const savedLabels = JSON.parse(localStorage.getItem('sampleLabels') || '{}')
    const labeledCount = Object.keys(savedLabels).length
    const confirmed = Object.values(savedLabels).filter(l => l === 'correct').length
    const misjudged = Object.values(savedLabels).filter(l => l === 'wrong').length
    const uncertain = Object.values(savedLabels).filter(l => l === 'uncertain').length

    const now = new Date()
    const weeklyTrend = []
    let maxDaily = 1
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      const count = completed.filter(t => {
        const cd = new Date(t.created_at)
        return cd.toDateString() === d.toDateString()
      }).length
      if (count > maxDaily) maxDaily = count
      weeklyTrend.push({ date: dateStr, count })
    }

    return {
      total, tampered, normal, tamperedRate,
      accuracy: labeledCount > 0 ? Math.round((confirmed / labeledCount) * 100) : 0,
      falsePositiveRate: labeledCount > 0 ? Math.round((misjudged / labeledCount) * 100) : 0,
      dailyAverage: total > 0 ? Math.round(total / 7) : 0,
      confirmed, misjudged, uncertain,
      pendingReview: total - labeledCount,
      reviewedRate: total > 0 ? Math.round((labeledCount / total) * 100) : 0,
      weeklyTrend, maxDaily
    }
  } catch (e) {
    console.error('获取统计失败', e)
    return useMock.getStats()
  }
}

export async function getOperators() {
  return useMock.getOperators()
}
export async function getSampledRecords(rate) {
  if (USE_MOCK) return useMock.getSampledRecords(rate)
  try {
    // 获取所有已完成的记录
    const res = await api.get('/history?page=1&size=100')
    const completed = res.items.filter(t => t.status === 'COMPLETED')
    // 按比例随机抽样
    const count = Math.max(1, Math.round(completed.length * rate / 100))
    const shuffled = completed.sort(() => Math.random() - 0.5)
    const sampled = shuffled.slice(0, count)
    // 读取已有标注
    const savedLabels = JSON.parse(localStorage.getItem('sampleLabels') || '{}')
    return sampled.map(task => {
      const resultItems = task.multi_results || (task.result ? [task.result] : [])
      let isTampered = false
      for (const item of resultItems) {
        if (item.result === '篡改' || item.result === '可疑') isTampered = true
      }
      const imageUrl = localImageCache[task.task_id] || `/api/v3/result/${task.task_id}/visualization`
      return {
        taskId: task.task_id,
        fileName: localFileNameCache[task.task_id] || `检测图片_${task.task_id.substring(0, 8)}`,
        thumbnail: imageUrl,
        isTampered,
        manualLabel: savedLabels[task.task_id] || null
      }
    })
  } catch (e) {
    console.error('获取抽样记录失败', e)
    return useMock.getSampledRecords(rate)
  }
}

export async function saveSampleLabelApi(taskId, label) {
  if (USE_MOCK) return useMock.saveSampleLabel(taskId, label)
  // 保存到 localStorage
  const savedLabels = JSON.parse(localStorage.getItem('sampleLabels') || '{}')
  savedLabels[taskId] = label
  localStorage.setItem('sampleLabels', JSON.stringify(savedLabels))
  return { success: true }
}
