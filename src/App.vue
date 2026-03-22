<template>
  <a-config-provider :locale="zhCN">
    <div class="app-container">
      <AppHeader />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </a-config-provider>
</template>

<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import AppHeader from './components/AppHeader.vue'
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.main-content {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }
}
</style>
