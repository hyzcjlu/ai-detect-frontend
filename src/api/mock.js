/**
 * Mock 数据模拟模块
 * 在后端接口未完成时使用，保证 UI 开发进度不受影响
 */

// 模拟延迟
export const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms))

// 生成随机 ID
const generateId = () => Math.random().toString(36).substring(2, 15)

// 模拟的任务存储
const taskStore = new Map()

// 模拟数据库
const mockDatabase = {
  records: [
    {
      taskId: 'task_001',
      fileName: '身份证正面.jpg',
      thumbnail: 'https://picsum.photos/100/100?random=1',
      imageUrl: 'https://picsum.photos/800/600?random=1',
      status: 'completed',
      isTampered: true,
      confidenceScore: 35,
      createdAt: Date.now() - 3600000,
      completedAt: Date.now() - 3500000,
      imageSize: '1920x1080',
      processingTime: 2.3,
      boxes: [
        { x1: 150, y1: 100, x2: 350, y2: 180, label: '字体异常', result: '篡改', confidence: 0.85 },
        { x1: 400, y1: 250, x2: 550, y2: 320, label: '边缘模糊', result: '可疑', confidence: 0.62 }
      ],
      details: [
        { type: 'warning', title: '字体不一致', description: '检测到区域内字体与周围存在明显差异' },
        { type: 'warning', title: '边缘异常', description: '发现疑似PS处理的边缘痕迹' },
        { type: 'info', title: 'EXIF信息', description: '图片元数据显示经过编辑软件处理' }
      ]
    },
    {
      taskId: 'task_002',
      fileName: '合同扫描件.png',
      thumbnail: 'https://picsum.photos/100/100?random=2',
      imageUrl: 'https://picsum.photos/800/600?random=2',
      status: 'completed',
      isTampered: false,
      confidenceScore: 92,
      createdAt: Date.now() - 7200000,
      completedAt: Date.now() - 7100000,
      imageSize: '2480x3508',
      processingTime: 3.1,
      boxes: [],
      details: [
        { type: 'info', title: '图片完整', description: '未检测到明显的篡改痕迹' },
        { type: 'info', title: '像素一致', description: '图片各区域像素分布正常' }
      ]
    },
    {
      taskId: 'task_003',
      fileName: '发票照片.jpg',
      thumbnail: 'https://picsum.photos/100/100?random=3',
      imageUrl: 'https://picsum.photos/800/600?random=3',
      status: 'completed',
      isTampered: true,
      confidenceScore: 28,
      createdAt: Date.now() - 86400000,
      completedAt: Date.now() - 86300000,
      imageSize: '1280x720',
      processingTime: 1.8,
      boxes: [
        { x1: 200, y1: 150, x2: 400, y2: 220, label: '数字篡改', result: '篡改', confidence: 0.78 }
      ],
      details: [
        { type: 'warning', title: '数字异常', description: '金额数字区域存在明显的图像处理痕迹' },
        { type: 'info', title: '噪点分析', description: '局部区域噪点分布与整体不一致' }
      ]
    },
    {
      taskId: 'task_004',
      fileName: '证书扫描.pdf.jpg',
      thumbnail: 'https://picsum.photos/100/100?random=4',
      imageUrl: 'https://picsum.photos/800/600?random=4',
      status: 'detecting',
      isTampered: null,
      confidenceScore: null,
      createdAt: Date.now() - 60000,
      completedAt: null,
      imageSize: '1654x2339',
      processingTime: null,
      boxes: [],
      details: []
    },
    {
      taskId: 'task_005',
      fileName: '户口本首页.jpg',
      thumbnail: 'https://picsum.photos/100/100?random=5',
      imageUrl: 'https://picsum.photos/800/600?random=5',
      status: 'completed',
      isTampered: false,
      confidenceScore: 88,
      createdAt: Date.now() - 172800000,
      completedAt: Date.now() - 172700000,
      imageSize: '1920x1280',
      processingTime: 2.5,
      boxes: [],
      details: [
        { type: 'info', title: '检测通过', description: '图片真实性验证通过' }
      ]
    }
  ]
}

// Mock API 实现
export const useMock = {
  /**
   * 上传图片
   */
  async uploadImage(file) {
    await mockDelay(800)
    
    const taskId = `task_${generateId()}`
    const thumbnail = URL.createObjectURL(file)
    
    // 模拟任务进度
    taskStore.set(taskId, {
      status: 'uploading',
      progress: 0,
      startTime: Date.now()
    })
    
    // 模拟上传完成后开始检测
    setTimeout(() => {
      const task = taskStore.get(taskId)
      if (task) {
        task.status = 'detecting'
        task.progress = 50
      }
    }, 2000)
    
    // 模拟检测完成
    setTimeout(() => {
      const task = taskStore.get(taskId)
      if (task) {
        task.status = 'completed'
        task.progress = 100
        task.result = {
          taskId,
          fileName: file.name,
          thumbnail,
          imageUrl: thumbnail,
          status: 'completed',
          isTampered: Math.random() > 0.5,
          confidenceScore: Math.floor(Math.random() * 40 + 60),
          createdAt: task.startTime,
          completedAt: Date.now(),
          imageSize: '1920x1080',
          processingTime: ((Date.now() - task.startTime) / 1000).toFixed(1),
          boxes: Math.random() > 0.5 ? [
            {
              x1: Math.floor(Math.random() * 200 + 100),
              y1: Math.floor(Math.random() * 100 + 50),
              x2: Math.floor(Math.random() * 200 + 350),
              y2: Math.floor(Math.random() * 100 + 180),
              label: '疑似篡改区域',
              result: Math.random() > 0.3 ? '篡改' : '可疑',
              confidence: Math.random() * 0.3 + 0.6
            }
          ] : [],
          details: [
            { type: 'info', title: 'AI分析完成', description: '图片已完成全面分析' },
            { type: Math.random() > 0.5 ? 'warning' : 'info', title: '特征检测', description: '已完成图像特征提取与比对' }
          ]
        }
      }
    }, 6000)
    
    return { taskId, message: '上传成功' }
  },
  
  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId) {
    await mockDelay(200)
    
    const task = taskStore.get(taskId)
    if (task) {
      return { status: task.status, progress: task.progress }
    }
    
    // 查找已有记录
    const record = mockDatabase.records.find(r => r.taskId === taskId)
    if (record) {
      return { status: record.status, progress: 100 }
    }
    
    return { status: 'not_found', error: '任务不存在' }
  },
  
  /**
   * 获取检测结果
   */
  async getTaskResult(taskId) {
    await mockDelay(300)
    
    const task = taskStore.get(taskId)
    if (task && task.result) {
      return task.result
    }
    
    // 查找已有记录
    const record = mockDatabase.records.find(r => r.taskId === taskId)
    if (record) {
      return record
    }
    
    throw new Error('结果不存在')
  },
  
  /**
   * 获取最近记录
   */
  async getRecentRecords() {
    await mockDelay(300)
    return mockDatabase.records
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
  },
  
  /**
   * 获取记录列表
   */
  async getRecordList(params = {}) {
    await mockDelay(400)
    
    let list = [...mockDatabase.records]
    
    // 状态筛选
    if (params.status) {
      list = list.filter(r => r.status === params.status)
    }
    
    // 结果筛选
    if (params.result === 'tampered') {
      list = list.filter(r => r.isTampered === true)
    } else if (params.result === 'normal') {
      list = list.filter(r => r.isTampered === false)
    }
    
    // 关键词搜索
    if (params.keyword) {
      list = list.filter(r => r.fileName.includes(params.keyword))
    }
    
    // 日期筛选
    if (params.startDate) {
      const start = new Date(params.startDate).getTime()
      list = list.filter(r => r.createdAt >= start)
    }
    if (params.endDate) {
      const end = new Date(params.endDate).getTime() + 86400000
      list = list.filter(r => r.createdAt <= end)
    }
    
    // 排序
    list.sort((a, b) => b.createdAt - a.createdAt)
    
    // 分页
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    const end = start + pageSize
    
    return {
      list: list.slice(start, end),
      total: list.length
    }
  },
  
  /**
   * 删除记录
   */
  async deleteRecord(taskId) {
    await mockDelay(300)
    const index = mockDatabase.records.findIndex(r => r.taskId === taskId)
    if (index > -1) {
      mockDatabase.records.splice(index, 1)
    }
    return { success: true }
  },
  
  /**
   * 获取统计数据
   */
  async getStats() {
    await mockDelay(200)
    const completed = mockDatabase.records.filter(r => r.status === 'completed')
    const tampered = completed.filter(r => r.isTampered).length
    const normal = completed.filter(r => !r.isTampered).length
    const total = mockDatabase.records.length
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 生成近7天趋势
    const weeklyTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      weeklyTrend.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        count: Math.floor(Math.random() * 50 + 10)
      })
    }
    
    return {
      total,
      tampered,
      normal,
      tamperedRate: total > 0 ? Math.round((tampered / total) * 100) : 0,
      accuracy: 92.5,
      falsePositiveRate: 3.2,
      dailyAverage: 45,
      confirmed: 15,
      misjudged: 3,
      uncertain: 5,
      pendingReview: 8,
      reviewedRate: 74,
      weeklyTrend,
      maxDaily: 60,
      today: mockDatabase.records.filter(r => r.createdAt >= today.getTime()).length
    }
  },
  
  /**
   * 获取操作人列表
   */
  async getOperators() {
    await mockDelay(100)
    return ['张三', '李四', '王五', '系统自动']
  },
  
  /**
   * 获取待复核列表
   */
  async getReviewList(params = {}) {
    await mockDelay(300)
    
    // 模拟待复核数据（疑似篡改的记录）
    let list = mockDatabase.records
      .filter(r => r.status === 'completed' && r.isTampered)
      .map(r => ({
        ...r,
        reviewStatus: r.reviewStatus || 'pending',
        operator: r.operator || ['张三', '李四', '系统'][Math.floor(Math.random() * 3)],
        reviewHistory: r.reviewHistory || []
      }))
    
    // 复核状态筛选
    if (params.reviewStatus) {
      list = list.filter(r => r.reviewStatus === params.reviewStatus)
    }
    
    // 操作人筛选
    if (params.operator) {
      list = list.filter(r => r.operator === params.operator)
    }
    
    // 排序
    list.sort((a, b) => b.createdAt - a.createdAt)
    
    // 分页
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    const end = start + pageSize
    
    return {
      list: list.slice(start, end),
      total: list.length
    }
  },
  
  /**
   * 提交复核结果
   */
  async submitReviewResult(taskId, data) {
    await mockDelay(300)
    
    const record = mockDatabase.records.find(r => r.taskId === taskId)
    if (record) {
      record.reviewStatus = data.status
      record.reviewHistory = record.reviewHistory || []
      record.reviewHistory.unshift({
        status: data.status,
        note: data.note,
        reviewer: data.reviewer,
        time: Date.now()
      })
    }
    
    return { success: true }
  },
  
  /**
   * 获取抽样记录
   */
  async getSampledRecords(rate = 10) {
    await mockDelay(400)
    
    const completed = mockDatabase.records.filter(r => r.status === 'completed')
    const sampleSize = Math.ceil(completed.length * (rate / 100))
    
    // 随机抽样
    const shuffled = [...completed].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.max(sampleSize, 1)).map(r => ({
      ...r,
      manualLabel: null
    }))
  },
  
  /**
   * 保存样本标注
   */
  async saveSampleLabel(taskId, label) {
    await mockDelay(200)
    return { success: true }
  }
}
