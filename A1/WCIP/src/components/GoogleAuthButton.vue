<script setup>
defineProps({
  disabled: Boolean,
  busy: Boolean,
  label: { type: String, default: 'Continue with Google' },
})
defineEmits(['click'])
const googleLogo = '/images/brand/google-g.png'
</script>

<template>
  <button
    type="button"
    class="google-auth-button"
    :disabled="disabled || busy"
    :aria-busy="busy"
    @click="$emit('click')"
  >
    <img :src="googleLogo" width="20" height="20" alt="" aria-hidden="true" />
    <span>{{ busy ? 'Connecting to Google...' : label }}</span>
  </button>
</template>

<style scoped>
.google-auth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #747775;
  border-radius: 4px;
  color: #1f1f1f;
  background: #fff;
  font:
    500 14px/20px Arial,
    sans-serif;
}
.google-auth-button img {
  flex: 0 0 20px;
}
.google-auth-button:hover:not(:disabled) {
  background: #f5f7fa;
}
.google-auth-button:focus-visible {
  outline: 3px solid #244a96;
  outline-offset: 3px;
}
.google-auth-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
