import axios from 'axios'
import { useMock, mockDelay } from './mock'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 是否使用 Mock 数据（在后端接口未完成时设为 true）
const USE_MOCK = true

/**
 * 上传图片
 */
export async function uploadImage(file) {
  if (USE_MOCK) {
    return useMock.uploadImage(file)
  }
  
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/detection/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/**
 * 获取任务状态（轮询用）
 */
export async function getTaskStatus(taskId) {
  if (USE_MOCK) {
    return useMock.getTaskStatus(taskId)
  }
  return api.get(`/detection/status/${taskId}`)
}

/**
 * 获取检测结果
 */
export async function getTaskResult(taskId) {
  if (USE_MOCK) {
    return useMock.getTaskResult(taskId)
  }
  return api.get(`/detection/result/${taskId}`)
}

/**
 * 获取最近检测记录
 */
export async function getRecentRecords() {
  if (USE_MOCK) {
    return useMock.getRecentRecords()
  }
  return api.get('/detection/recent')
}

/**
 * 获取记录列表
 */
export async function getRecordList(params) {
  if (USE_MOCK) {
    return useMock.getRecordList(params)
  }
  return api.get('/detection/list', { params })
}

/**
 * 删除记录
 */
export async function deleteRecordById(taskId) {
  if (USE_MOCK) {
    return useMock.deleteRecord(taskId)
  }
  return api.delete(`/detection/${taskId}`)
}

/**
 * 获取统计数据
 */
export async function getStats() {
  if (USE_MOCK) {
    return useMock.getStats()
  }
  return api.get('/detection/stats')
}

/**
 * 获取操作人列表
 */
export async function getOperators() {
  if (USE_MOCK) {
    return useMock.getOperators()
  }
  return api.get('/detection/operators')
}

/**
 * 获取待复核列表
 */
export async function getReviewList(params) {
  if (USE_MOCK) {
    return useMock.getReviewList(params)
  }
  return api.get('/review/list', { params })
}

/**
 * 提交复核结果
 */
export async function submitReviewResult(taskId, data) {
  if (USE_MOCK) {
    return useMock.submitReviewResult(taskId, data)
  }
  return api.post(`/review/${taskId}`, data)
}

/**
 * 获取抽样记录
 */
export async function getSampledRecords(rate) {
  if (USE_MOCK) {
    return useMock.getSampledRecords(rate)
  }
  return api.get('/detection/sampling', { params: { rate } })
}

/**
 * 保存样本标注
 */
export async function saveSampleLabelApi(taskId, label) {
  if (USE_MOCK) {
    return useMock.saveSampleLabel(taskId, label)
  }
  return api.post(`/detection/sampling/${taskId}/label`, { label })
}
