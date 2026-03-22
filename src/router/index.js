import { createRouter, createWebHistory } from 'vue-router'
import UploadPage from '@/views/UploadPage.vue'
import ResultPage from '@/views/ResultPage.vue'
import ReviewPage from '@/views/ReviewPage.vue'
import AdminPage from '@/views/AdminPage.vue'

const routes = [
  {
    path: '/',
    name: 'Upload',
    component: UploadPage,
    meta: { title: '图片上传' }
  },
  {
    path: '/result/:taskId',
    name: 'Result',
    component: ResultPage,
    meta: { title: '检测结果' }
  },
  {
    path: '/review',
    name: 'Review',
    component: ReviewPage,
    meta: { title: '审核工作台' }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminPage,
    meta: { title: '后台管理' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || 'AI检测'} - AI图片篡改检测系统`
  next()
})

export default router
