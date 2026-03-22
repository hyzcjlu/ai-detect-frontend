<template>
  <div class="image-annotation" ref="containerRef">
    <img 
      ref="imageRef"
      :src="src" 
      :alt="alt"
      class="annotation-image"
      @load="onImageLoad"
      @error="onImageError"
    />
    
    <!-- 标注框层 -->
    <div class="annotation-layer" v-if="imageLoaded">
      <div
        v-for="(box, index) in scaledBoxes"
        :key="index"
        class="annotation-box"
        :class="{ 'annotation-box-active': activeIndex === index }"
        :style="getBoxStyle(box)"
        @mouseenter="activeIndex = index"
        @mouseleave="activeIndex = null"
      >
        <span class="annotation-label" :style="getLabelStyle(box)">
          {{ box.label || `区域 ${index + 1}` }}
        </span>
        
        <!-- 置信度显示 -->
        <span v-if="box.confidence" class="annotation-confidence">
          {{ Math.round(box.confidence * 100) }}%
        </span>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="!imageLoaded && !loadError" class="annotation-loading">
      <a-spin tip="图片加载中..." />
    </div>
    
    <!-- 加载失败 -->
    <div v-if="loadError" class="annotation-error">
      <ExclamationCircleOutlined />
      <span>图片加载失败</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'

const props = defineProps({
  // 图片 URL
  src: {
    type: String,
    required: true
  },
  // 图片 alt 文本
  alt: {
    type: String,
    default: '检测图片'
  },
  // 标注框数组 [{ x1, y1, x2, y2, label?, confidence? }]
  boxes: {
    type: Array,
    default: () => []
  },
  // 原始图片尺寸（可选，如果后端返回的话）
  originalWidth: {
    type: Number,
    default: 0
  },
  originalHeight: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['load', 'error', 'boxClick'])

const containerRef = ref(null)
const imageRef = ref(null)
const imageLoaded = ref(false)
const loadError = ref(false)
const activeIndex = ref(null)

// 图片尺寸
const imageNaturalSize = ref({ width: 0, height: 0 })
const imageDisplaySize = ref({ width: 0, height: 0 })

// 计算缩放后的标注框坐标
const scaledBoxes = computed(() => {
  if (!props.boxes.length || !imageLoaded.value) return []
  
  // 使用传入的原始尺寸或图片自身的自然尺寸
  const naturalWidth = props.originalWidth || imageNaturalSize.value.width
  const naturalHeight = props.originalHeight || imageNaturalSize.value.height
  
  if (!naturalWidth || !naturalHeight) return []
  
  // 计算缩放比例
  const scaleX = imageDisplaySize.value.width / naturalWidth
  const scaleY = imageDisplaySize.value.height / naturalHeight
  
  return props.boxes.map((box, index) => ({
    ...box,
    index,
    // 精确映射坐标
    scaledX1: Math.round(box.x1 * scaleX),
    scaledY1: Math.round(box.y1 * scaleY),
    scaledX2: Math.round(box.x2 * scaleX),
    scaledY2: Math.round(box.y2 * scaleY)
  }))
})

// 获取标注框样式
const getBoxStyle = (box) => {
  const width = box.scaledX2 - box.scaledX1
  const height = box.scaledY2 - box.scaledY1
  
  return {
    left: `${box.scaledX1}px`,
    top: `${box.scaledY1}px`,
    width: `${width}px`,
    height: `${height}px`
  }
}

// 获取标签位置样式（防止超出边界）
const getLabelStyle = (box) => {
  const style = {}
  
  // 如果标注框太靠顶部，标签放在框内
  if (box.scaledY1 < 30) {
    style.top = '4px'
    style.bottom = 'auto'
  }
  
  // 如果标注框太靠左边
  if (box.scaledX1 < 10) {
    style.left = '0'
  }
  
  return style
}

// 图片加载完成
const onImageLoad = () => {
  if (imageRef.value) {
    imageNaturalSize.value = {
      width: imageRef.value.naturalWidth,
      height: imageRef.value.naturalHeight
    }
    updateDisplaySize()
    imageLoaded.value = true
    loadError.value = false
    emit('load', imageNaturalSize.value)
  }
}

// 图片加载失败
const onImageError = () => {
  loadError.value = true
  imageLoaded.value = false
  emit('error')
}

// 更新显示尺寸
const updateDisplaySize = () => {
  if (imageRef.value) {
    imageDisplaySize.value = {
      width: imageRef.value.clientWidth,
      height: imageRef.value.clientHeight
    }
  }
}

// 监听窗口大小变化
const handleResize = () => {
  updateDisplaySize()
}

// 使用 ResizeObserver 监听容器大小变化
let resizeObserver = null

onMounted(() => {
  window.addEventListener('resize', handleResize)
  
  // 使用 ResizeObserver 更精确地监听尺寸变化
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateDisplaySize()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// 监听 src 变化重置状态
watch(() => props.src, () => {
  imageLoaded.value = false
  loadError.value = false
})
</script>

<style scoped>
.image-annotation {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
}

.annotation-image {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
}

.annotation-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.annotation-box {
  position: absolute;
  border: 2px solid #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 3px;
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.2s ease;
}

.annotation-box:hover,
.annotation-box-active {
  border-color: #ff7875;
  background: rgba(255, 77, 79, 0.2);
  box-shadow: 0 0 8px rgba(255, 77, 79, 0.4);
}

.annotation-label {
  position: absolute;
  top: -24px;
  left: -2px;
  background: #ff4d4f;
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  padding: 2px 8px;
  border-radius: 4px 4px 0 0;
  white-space: nowrap;
  font-weight: 500;
}

.annotation-box-active .annotation-label {
  background: #ff7875;
}

.annotation-confidence {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
}

.annotation-loading,
.annotation-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 4px;
  min-height: 200px;
}

.annotation-error {
  color: #999;
  gap: 8px;
}

.annotation-error .anticon {
  font-size: 32px;
}
</style>
