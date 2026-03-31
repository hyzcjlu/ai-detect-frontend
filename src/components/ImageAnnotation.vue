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
        :class="{
          'annotation-box-active': activeIndex === index,
          'annotation-box-dragging': isDragging && dragBoxIndex === index
        }"
        :style="getBoxStyle(box, index)"
        @mouseenter="!isDragging && !isResizing && (hoverIndex = index)"
        @mouseleave="!isDragging && !isResizing && (hoverIndex = null)"
        @mousedown.prevent="onBoxMouseDown($event, index)"
        @click.stop="onBoxClick(index)"
      >
        <span class="annotation-label" :style="getLabelStyle(box)">
          {{ box.label || `区域 ${index + 1}` }}
        </span>

        <span v-if="box.confidence" class="annotation-confidence">
          {{ Math.round(box.confidence * 100) }}%
        </span>

        <!-- 拖拽/调整大小时显示实时坐标 -->
        <span
          v-if="(isDragging || isResizing) && dragBoxIndex === index"
          class="annotation-live-coords"
        >
          [{{ liveOrigCoords.x1 }}, {{ liveOrigCoords.y1 }}, {{ liveOrigCoords.x2 }}, {{ liveOrigCoords.y2 }}]
        </span>

        <!-- 8 个调整大小手柄（仅激活或悬停时显示） -->
        <template v-if="activeIndex === index || hoverIndex === index">
          <div
            v-for="dir in resizeDirs"
            :key="dir"
            class="resize-handle"
            :class="`resize-${dir}`"
            @mousedown.stop.prevent="onResizeMouseDown($event, index, dir)"
          ></div>
        </template>
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
  src: { type: String, required: true },
  alt: { type: String, default: '检测图片' },
  boxes: { type: Array, default: () => [] },
  highlightIndex: { type: Number, default: -1 },
  originalWidth: { type: Number, default: 0 },
  originalHeight: { type: Number, default: 0 }
})

const emit = defineEmits(['load', 'error', 'box-click', 'box-move', 'box-resize'])

const containerRef = ref(null)
const imageRef = ref(null)
const imageLoaded = ref(false)
const loadError = ref(false)
const hoverIndex = ref(null)

// 图片尺寸
const imageNaturalSize = ref({ width: 0, height: 0 })
const imageDisplaySize = ref({ width: 0, height: 0 })

// ---- 拖拽状态 ----
const isDragging = ref(false)
const dragBoxIndex = ref(-1)
const dragStartMouse = ref({ x: 0, y: 0 })
const dragOffsetPx = ref({ dx: 0, dy: 0 })
let didDrag = false

// ---- 调整大小状态 ----
const isResizing = ref(false)
const resizeBoxIndex = ref(-1)
const resizeDir = ref('') // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
const resizeStartMouse = ref({ x: 0, y: 0 })
const resizeStartBox = ref({ x1: 0, y1: 0, x2: 0, y2: 0 })

// 8 个方向
const resizeDirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// hover 优先，其次外部 highlightIndex，拖拽/缩放时显示当前操作的框
const activeIndex = computed(() => {
  if (isResizing.value && resizeBoxIndex.value >= 0) return resizeBoxIndex.value
  if (isDragging.value && dragBoxIndex.value !== -1) return dragBoxIndex.value
  if (hoverIndex.value !== null) return hoverIndex.value
  if (props.highlightIndex >= 0) return props.highlightIndex
  return null
})

// 当前缩放比例
const scaleRatio = computed(() => {
  const naturalWidth = props.originalWidth || imageNaturalSize.value.width
  const naturalHeight = props.originalHeight || imageNaturalSize.value.height
  if (!naturalWidth || !naturalHeight) return { x: 1, y: 1 }
  return {
    x: imageDisplaySize.value.width / naturalWidth,
    y: imageDisplaySize.value.height / naturalHeight
  }
})

// 实时原始坐标（拖拽/调整大小时显示）
const liveOrigCoords = computed(() => {
  let idx = -1
  if (isResizing.value) idx = resizeBoxIndex.value
  else if (isDragging.value) idx = dragBoxIndex.value
  if (idx < 0) return {}
  
  const box = props.boxes[idx]
  if (!box) return {}
  const { x, y } = scaleRatio.value
  
  if (isResizing.value) {
    // 根据方向计算新坐标
    const d = resizeDir.value
    const dx = Math.round(resizeOffsetPx.value.dx / x)
    const dy = Math.round(resizeOffsetPx.value.dy / y)
    
    let nx1 = resizeStartBox.value.x1, ny1 = resizeStartBox.value.y1
    let nx2 = resizeStartBox.value.x2, ny2 = resizeStartBox.value.y2
    
    if (d.includes('n')) ny1 += dy
    if (d.includes('s')) ny2 += dy
    if (d.includes('w')) nx1 += dx
    if (d.includes('e')) nx2 += dx
    
    // 约束：不交叉
    if (nx1 >= nx2) nx1 = nx2 - 10
    if (ny1 >= ny2) ny1 = ny2 - 10
    
    return { x1: Math.max(0, nx1), y1: Math.max(0, ny1), x2: nx2, y2: ny2 }
  } else {
    // 拖拽
    const ddx = Math.round(dragOffsetPx.value.dx / x)
    const ddy = Math.round(dragOffsetPx.value.dy / y)
    return {
      x1: box.x1 + ddx, y1: box.y1 + ddy,
      x2: box.x2 + ddx, y2: box.y2 + ddy
    }
  }
})

// 调整大小的像素偏移
const resizeOffsetPx = ref({ dx: 0, dy: 0 })

// 计算缩放后的标注框坐标（拖拽时叠加偏移）
const scaledBoxes = computed(() => {
  if (!props.boxes.length || !imageLoaded.value) return []
  const { x: scaleX, y: scaleY } = scaleRatio.value
  if (!scaleX || !scaleY) return []

  return props.boxes.map((box, index) => {
    let dx = 0, dy = 0
    if (isDragging.value && dragBoxIndex.value === index) {
      dx = dragOffsetPx.value.dx
      dy = dragOffsetPx.value.dy
    } else if (isResizing.value && resizeBoxIndex.value === index) {
      dx = resizeOffsetPx.value.dx
      dy = resizeOffsetPx.value.dy
    }
    const sx1 = Math.round(box.x1 * scaleX) + dx
    const sy1 = Math.round(box.y1 * scaleY) + dy
    const sx2 = Math.round(box.x2 * scaleX) + dx
    const sy2 = Math.round(box.y2 * scaleY) + dy
    return { ...box, index, scaledX1: sx1, scaledY1: sy1, scaledX2: sx2, scaledY2: sy2 }
  })
})

// ---- 拖拽事件 ----
const onBoxMouseDown = (e, index) => {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()

  isDragging.value = true
  dragBoxIndex.value = index
  dragStartMouse.value = { x: e.clientX, y: e.clientY }
  dragOffsetPx.value = { dx: 0, dy: 0 }
  didDrag = false

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

// ---- 调整大小事件 ----
const onResizeMouseDown = (e, index, dir) => {
  e.preventDefault()
  e.stopPropagation()
  
  isResizing.value = true
  resizeBoxIndex.value = index
  resizeDir.value = dir
  resizeStartMouse.value = { x: e.clientX, y: e.clientY }
  resizeOffsetPx.value = { dx: 0, dy: 0 }
  
  const box = props.boxes[index]
  resizeStartBox.value = { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 }
  
  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

const onGlobalMouseMove = (e) => {
  if (isDragging.value) {
    const dx = e.clientX - dragStartMouse.value.x
    const dy = e.clientY - dragStartMouse.value.y
    dragOffsetPx.value = { dx, dy }
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true
  } else if (isResizing.value) {
    resizeOffsetPx.value = { dx: e.clientX - resizeStartMouse.value.x, dy: e.clientY - resizeStartMouse.value.y }
  }
}

const onGlobalMouseUp = () => {
  if (isDragging.value && dragBoxIndex.value >= 0 && didDrag) {
    const box = props.boxes[dragBoxIndex.value]
    const { x: scaleX, y: scaleY } = scaleRatio.value
    const dx = Math.round(dragOffsetPx.value.dx / scaleX)
    const dy = Math.round(dragOffsetPx.value.dy / scaleY)

    const naturalW = props.originalWidth || imageNaturalSize.value.width
    const naturalH = props.originalHeight || imageNaturalSize.value.height
    const bw = box.x2 - box.x1
    const bh = box.y2 - box.y1
    const newX1 = Math.max(0, Math.min(naturalW - bw, box.x1 + dx))
    const newY1 = Math.max(0, Math.min(naturalH - bh, box.y1 + dy))

    emit('box-move', dragBoxIndex.value, {
      x1: newX1, y1: newY1, x2: newX1 + bw, y2: newY1 + bh
    })
  } else if (isResizing.value && resizeBoxIndex.value >= 0) {
    const { x: scaleX, y: scaleY } = scaleRatio.value
    const dx = Math.round(resizeOffsetPx.value.dx / scaleX)
    const dy = Math.round(resizeOffsetPx.value.dy / scaleY)
    
    const d = resizeDir.value
    let { x1, y1, x2, y2 } = resizeStartBox.value
    
    if (d.includes('n')) y1 += dy
    if (d.includes('s')) y2 += dy
    if (d.includes('w')) x1 += dx
    if (d.includes('e')) x2 += dx
    
    // 约束：最小尺寸、不超出边界
    const minSize = 10
    const naturalW = props.originalWidth || imageNaturalSize.value.width
    const naturalH = props.originalHeight || imageNaturalSize.value.height
    
    if (x2 - x1 < minSize) {
      if (d.includes('e')) x2 = x1 + minSize
      else x1 = x2 - minSize
    }
    if (y2 - y1 < minSize) {
      if (d.includes('s')) y2 = y1 + minSize
      else y1 = y2 - minSize
    }
    
    x1 = Math.max(0, Math.min(naturalW - minSize, x1))
    x2 = Math.min(naturalW, Math.max(minSize, x2))
    y1 = Math.max(0, Math.min(naturalH - minSize, y1))
    y2 = Math.min(naturalH, Math.max(minSize, y2))
    
    emit('box-resize', resizeBoxIndex.value, { x1, y1, x2, y2 })
  }

  isDragging.value = false
  dragBoxIndex.value = -1
  dragOffsetPx.value = { dx: 0, dy: 0 }
  
  isResizing.value = false
  resizeBoxIndex.value = -1
  resizeDir.value = ''
  resizeOffsetPx.value = { dx: 0, dy: 0 }
  
  hoverIndex.value = null

  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
}

// 点击（拖动过则不触发）
const onBoxClick = (index) => {
  if (didDrag) return
  emit('box-click', index)
}

// ---- 样式 ----
// 根据检测结果返回颜色：篡改=红，可疑=黄，正常=绿
const getBoxColor = (box) => {
  const result = box.result || ''
  if (result === '篡改' || result.includes('篡改')) {
    return { border: '#ff4d4f', bg: 'rgba(255, 77, 79, 0.15)', label: '#ff4d4f' }
  } else if (result === '可疑' || result.includes('可疑') || result.includes('疑似')) {
    return { border: '#faad14', bg: 'rgba(250, 173, 20, 0.15)', label: '#faad14' }
  } else {
    return { border: '#52c41a', bg: 'rgba(82, 196, 26, 0.12)', label: '#52c41a' }
  }
}

const getBoxStyle = (box, index) => {
  const w = box.scaledX2 - box.scaledX1
  const h = box.scaledY2 - box.scaledY1
  const draggingThis = isDragging.value && dragBoxIndex.value === index
  const resizingThis = isResizing.value && resizeBoxIndex.value === index
  const isActive = draggingThis || resizingThis
  const color = getBoxColor(box)
  return {
    left: `${box.scaledX1}px`,
    top: `${box.scaledY1}px`,
    width: `${w}px`,
    height: `${h}px`,
    borderColor: color.border,
    backgroundColor: color.bg,
    cursor: isActive ? (draggingThis ? 'grabbing' : 'move') : 'grab',
    transition: isActive ? 'none' : 'box-shadow 0.2s, border-color 0.2s, background 0.2s',
    userSelect: 'none'
  }
}

const getLabelStyle = (box) => {
  const color = getBoxColor(box)
  const style = { backgroundColor: color.label }
  if (box.scaledY1 < 30) { style.top = '4px'; style.bottom = 'auto' }
  if (box.scaledX1 < 10) { style.left = '0' }
  return style
}

// ---- 图片加载 ----
const onImageLoad = () => {
  if (imageRef.value) {
    imageNaturalSize.value = { width: imageRef.value.naturalWidth, height: imageRef.value.naturalHeight }
    updateDisplaySize()
    imageLoaded.value = true
    loadError.value = false
    emit('load', imageNaturalSize.value)
  }
}

const onImageError = () => {
  loadError.value = true
  imageLoaded.value = false
  emit('error')
}

const updateDisplaySize = () => {
  if (imageRef.value) {
    imageDisplaySize.value = { width: imageRef.value.clientWidth, height: imageRef.value.clientHeight }
  }
}

// ---- 监听窗口/容器大小 ----
let resizeObserver = null

onMounted(() => {
  window.addEventListener('resize', updateDisplaySize)
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(updateDisplaySize)
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateDisplaySize)
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
  if (resizeObserver) resizeObserver.disconnect()
})

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
}

.annotation-box:hover,
.annotation-box-active {
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
  filter: brightness(1.1);
}

.annotation-box-dragging {
  box-shadow: 0 0 0 3px rgba(250, 173, 20, 0.3), 0 4px 16px rgba(0,0,0,0.2) !important;
  z-index: 10;
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
  pointer-events: none;
}

.annotation-box-active .annotation-label,
.annotation-box-dragging .annotation-label {
  filter: brightness(1.1);
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
  pointer-events: none;
}

/* 拖拽/调整大小时实时坐标 */
.annotation-live-coords {
  position: absolute;
  bottom: -22px;
  left: -2px;
  background: rgba(0, 0, 0, 0.75);
  color: #ffe58f;
  font-family: 'Consolas', monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 0 0 4px 4px;
  white-space: nowrap;
  pointer-events: none;
}

/* 8 个调整大小手柄 */
.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 2px solid #faad14;
  border-radius: 50%;
  z-index: 20;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}

.resize-handle:hover {
  transform: scale(1.3);
  background: #fffbe6;
}

/* 四个角 */
.resize-nw { top: -6px; left: -6px; cursor: nw-resize; }
.resize-ne { top: -6px; right: -6px; cursor: ne-resize; }
.resize-sw { bottom: -6px; left: -6px; cursor: sw-resize; }
.resize-se { bottom: -6px; right: -6px; cursor: se-resize; }

/* 四条边中点 */
.resize-n { top: -6px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
.resize-s { bottom: -6px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
.resize-w { left: -6px; top: 50%; transform: translateY(-50%); cursor: w-resize; }
.resize-e { right: -6px; top: 50%; transform: translateY(-50%); cursor: e-resize; }

.annotation-loading,
.annotation-error {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 4px;
  min-height: 200px;
}

.annotation-error { color: #999; gap: 8px; }
.annotation-error .anticon { font-size: 32px; }
</style>
