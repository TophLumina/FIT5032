<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  rows: { type: Array, required: true },
  series: { type: Array, required: true },
  selectedDay: { type: String, default: '' },
})
const emit = defineEmits(['select'])
const active = ref(0)
const hovered = ref(null)
const elements = new Map()
const maximum = computed(() =>
  Math.max(1, ...props.rows.flatMap((row) => props.series.map((series) => row[series.key]))),
)
const x = (index) => 64 + (index * 820) / Math.max(1, props.rows.length - 1)
const y = (value) => 234 - (value * 190) / maximum.value
const points = computed(() =>
  props.series.flatMap((series, seriesIndex) =>
    props.rows.map((row, dayIndex) => ({
      day: row.day,
      value: row[series.key],
      label: series.label,
      color: series.color,
      x: x(dayIndex),
      y: y(row[series.key]),
      index: seriesIndex * props.rows.length + dayIndex,
    })),
  ),
)
const detail = computed(() => (hovered.value === null ? null : points.value[hovered.value]))
const path = (series) =>
  props.rows.map((row, index) => `${x(index)},${y(row[series.key])}`).join(' ')
watch(
  () => [props.rows, props.series],
  () => {
    active.value = 0
    hovered.value = null
  },
)

function focusPoint(index) {
  active.value = index
  hovered.value = index
}

async function navigate(event, index) {
  const size = props.rows.length
  let target
  const key = event.key
  if (key === 'ArrowRight') target = Math.min(points.value.length - 1, index + 1)
  else if (key === 'ArrowLeft') target = Math.max(0, index - 1)
  else if (key === 'ArrowDown') target = (index + size) % points.value.length
  else if (key === 'ArrowUp') target = (index - size + points.value.length) % points.value.length
  else if (key === 'Home') target = 0
  else if (key === 'End') target = points.value.length - 1
  else if (key === 'Enter' || key === ' ') {
    event.preventDefault()
    emit('select', points.value[index].day)
    return
  } else return
  event.preventDefault()
  active.value = target
  await nextTick()
  elements.get(target)?.focus()
}
</script>

<template>
  <div>
    <p id="activity-chart-help" class="small text-body-secondary">
      Focus a point, then use arrow keys to explore days or series. Enter selects a day and filters
      the comment details below. The daily data table provides the same information.
    </p>
    <div
      class="chart-scroll border rounded"
      role="region"
      aria-label="Activity trend chart"
      tabindex="0"
    >
      <svg
        viewBox="0 0 960 290"
        role="group"
        aria-label="Daily recorded activity"
        aria-describedby="activity-chart-help"
      >
        <g aria-hidden="true">
          <template v-for="step in [0, 0.5, 1]" :key="step">
            <line
              x1="64"
              x2="884"
              :y1="y(maximum * step)"
              :y2="y(maximum * step)"
              stroke="#ccd6d0"
            />
            <text x="54" :y="y(maximum * step) + 5" text-anchor="end">
              {{ Number((maximum * step).toFixed(1)) }}
            </text>
          </template>
          <text x="64" y="266">{{ rows[0]?.day }}</text>
          <text x="884" y="266" text-anchor="end">{{ rows.at(-1)?.day }}</text>
          <polyline
            v-for="(seriesItem, index) in series"
            :key="seriesItem.key"
            :points="path(seriesItem)"
            fill="none"
            :stroke="seriesItem.color"
            stroke-width="2.5"
            :stroke-dasharray="index ? '7 4' : undefined"
          />
        </g>
        <circle
          v-for="point in points"
          :key="`${point.label}-${point.day}`"
          :ref="
            (element) =>
              element ? elements.set(point.index, element) : elements.delete(point.index)
          "
          :cx="point.x"
          :cy="point.y"
          :r="selectedDay === point.day ? 6 : 4"
          :fill="point.color"
          stroke="white"
          stroke-width="1.5"
          role="button"
          :tabindex="active === point.index ? 0 : -1"
          :aria-label="`${point.day}: ${point.value} ${point.label}. View day details`"
          :aria-pressed="selectedDay === point.day"
          @focus="focusPoint(point.index)"
          @mouseenter="hovered = point.index"
          @mouseleave="hovered = null"
          @keydown="navigate($event, point.index)"
          @click="emit('select', point.day)"
        >
          <title>{{ point.day }}: {{ point.value }} {{ point.label }}</title>
        </circle>
      </svg>
    </div>
    <p class="small mt-2 mb-0 chart-readout">
      {{
        detail
          ? `${detail.day} · ${detail.label}: ${detail.value}`
          : 'Hover or focus a point to read its value.'
      }}
    </p>
  </div>
</template>

<style scoped>
.chart-scroll {
  overflow-x: auto;
  background: #fbfdfb;
}
svg {
  display: block;
  width: 100%;
  min-width: 640px;
}
text {
  font-size: 14px;
  fill: #394d43;
}
circle {
  cursor: pointer;
}
circle:focus {
  outline: none;
  stroke: #152d60;
  stroke-width: 4;
}
.chart-scroll:focus-visible {
  outline: 3px solid #244a96;
  outline-offset: 3px;
}
.chart-readout {
  min-height: 1.5em;
}
</style>
