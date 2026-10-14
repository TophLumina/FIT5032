<script setup>
import { computed, ref, watch } from 'vue'
import { cellText, selectRows } from '../../shared/tableQuery.js'

const props = defineProps({
  id: { type: String, required: true },
  caption: { type: String, required: true },
  rows: { type: Array, required: true },
  columns: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  initialSort: { type: String, default: '' },
  initialDirection: { type: String, default: 'asc' },
  showSearch: { type: Boolean, default: true },
})
const emit = defineEmits(['change'])
const q = ref('')
const filters = ref({})
const sort = ref(props.initialSort)
const direction = ref(props.initialDirection)
const page = ref(1)
const pageSize = 10
watch(
  () => [props.initialSort, props.initialDirection],
  () => {
    sort.value = props.initialSort
    direction.value = props.initialDirection
  },
)
const matching = computed(() =>
  selectRows(props.rows, props.columns, {
    q: q.value,
    filters: filters.value,
    sort: sort.value,
    direction: direction.value,
  }),
)
const pages = computed(() => Math.max(1, Math.ceil(matching.value.length / pageSize)))
const visible = computed(() =>
  matching.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
watch(
  matching,
  (rows) => {
    page.value = 1
    emit('change', rows)
  },
  { immediate: true },
)

function sortBy(key) {
  direction.value = sort.value === key && direction.value === 'asc' ? 'desc' : 'asc'
  sort.value = key
}
function reset() {
  q.value = ''
  filters.value = {}
  sort.value = props.initialSort
  direction.value = props.initialDirection
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap gap-2 align-items-end mb-3">
      <div v-if="showSearch" class="flex-grow-1">
        <label class="form-label" :for="`${id}-search`">Search all columns</label>
        <input
          :id="`${id}-search`"
          v-model="q"
          type="search"
          class="form-control"
          maxlength="100"
        />
      </div>
      <button type="button" class="btn btn-outline-primary" @click="reset">
        Clear table filters
      </button>
    </div>
    <p :id="`${id}-help`" class="small text-body-secondary">
      Select a column heading to sort. Column searches combine with the search above. Up to 10 rows
      per page. Scroll horizontally to compare every column.
    </p>
    <div
      class="table-responsive"
      role="region"
      :aria-label="caption"
      :aria-describedby="`${id}-help`"
      tabindex="0"
    >
      <table class="table table-hover align-middle comparison-table">
        <caption class="visually-hidden">
          {{
            caption
          }}
        </caption>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              :aria-sort="
                sort === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
              "
            >
              <button
                type="button"
                class="btn btn-link text-body p-0 text-start fw-bold"
                :aria-label="`Sort by ${column.label}, ${sort === column.key && direction === 'asc' ? 'descending' : 'ascending'}`"
                @click="sortBy(column.key)"
              >
                {{ column.label }}
                <span aria-hidden="true">{{
                  sort === column.key ? (direction === 'asc' ? '↑' : '↓') : '↕'
                }}</span>
              </button>
            </th>
          </tr>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col">
              <label class="visually-hidden" :for="`${id}-${column.key}`"
                >Search {{ column.label }}</label
              >
              <input
                :id="`${id}-${column.key}`"
                v-model="filters[column.key]"
                class="form-control form-control-sm"
                type="search"
                maxlength="100"
                :placeholder="column.label"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row[rowKey]">
            <td v-for="column in columns" :key="column.key" class="text-break">
              <slot :name="`cell-${column.key}`" :row="row">{{
                cellText(row, column) || '—'
              }}</slot>
            </td>
          </tr>
          <tr v-if="!matching.length">
            <td :colspan="columns.length" class="py-4">No rows match these searches.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
      <p class="small mb-0" role="status" aria-live="polite">
        {{ matching.length ? (page - 1) * pageSize + 1 : 0 }}–{{
          Math.min(page * pageSize, matching.length)
        }}
        of {{ matching.length }} results · Page {{ page }} of {{ pages }}
      </p>
      <nav class="d-flex align-items-center gap-2" :aria-label="`${caption} pages`">
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="page === 1"
          @click="page--"
        >
          Previous
        </button>
        <label class="visually-hidden" :for="`${id}-page`">Page</label>
        <select :id="`${id}-page`" v-model.number="page" class="form-select form-select-sm w-auto">
          <option v-for="number in pages" :key="number" :value="number">{{ number }}</option>
        </select>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="page === pages"
          @click="page++"
        >
          Next
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.table-responsive {
  position: relative;
}
.comparison-table th {
  min-width: 9rem;
}
.comparison-table th button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.comparison-table input::placeholder {
  color: #596168;
  opacity: 1;
}
.comparison-table td {
  max-width: 22rem;
}
</style>
