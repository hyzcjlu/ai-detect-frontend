<template>
  <header class="app-header">
    <div class="header-content">
      <div class="logo" @click="router.push('/')">
        <SafetyCertificateOutlined class="logo-icon" />
        <span class="logo-text">AI 图片篡改检测</span>
      </div>
      <nav class="nav-menu">
        <router-link to="/" class="nav-item" active-class="active">
          <UploadOutlined />
          <span>上传检测</span>
        </router-link>
        <router-link to="/admin" class="nav-item" active-class="active">
          <SettingOutlined />
          <span>后台管理</span>
        </router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { 
  SafetyCertificateOutlined, 
  UploadOutlined, 
  SettingOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
</script>

<style scoped>
.app-header {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--primary-color);
  font-size: 18px;
  font-weight: 600;
}

.logo-icon {
  font-size: 24px;
}

.nav-menu {
  display: flex;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.3s;
}

.nav-item:hover {
  background: #f0f5ff;
  color: var(--primary-color);
}

.nav-item.active {
  background: #e6f7ff;
  color: var(--primary-color);
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .logo-text {
    display: none;
  }
  
  .nav-item span {
    display: none;
  }
  
  .nav-item {
    padding: 10px 12px;
  }
}
</style>
