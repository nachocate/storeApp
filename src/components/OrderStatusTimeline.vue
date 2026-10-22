<script setup>
import { computed, ref, watch } from 'vue'
import {
  buildFallbackTimeline,
  getCurrentStepIndex,
  getStatusMessage,
  getStatusTone,
  normalizeStatusTimeline
} from '../utils/orderStatusStyles.js'
import { isStatusSoundMuted, playStatusChime, setStatusSoundMuted } from '../utils/statusSound.js'

const props = defineProps({
  status: { type: String, default: '' },
  timeline: { type: Array, default: undefined },
  fulfillmentType: { type: String, default: '' },
  paymentProvider: { type: String, default: '' }
})

const steps = computed(() =>
  normalizeStatusTimeline(props.timeline) ?? buildFallbackTimeline(props)
)
const currentIndex = computed(() => getCurrentStepIndex(steps.value))
const currentStep = computed(() => steps.value[currentIndex.value])
const cancelled = computed(() => getStatusTone(currentStep.value?.code ?? props.status) === 'danger')
const message = computed(() => getStatusMessage(props.status))
const hasNextStep = computed(() => currentIndex.value < steps.value.length - 1)

const muted = ref(isStatusSoundMuted())
const toggleSound = () => {
  muted.value = !muted.value
  setStatusSoundMuted(muted.value)
  if (!muted.value) playStatusChime()
}

watch(() => props.status, (status, previousStatus) => {
  if (previousStatus && status !== previousStatus) playStatusChime()
})
</script>

<template>
  <section class="order-timeline" :class="{ cancelled }" aria-label="Hoja de ruta del pedido">
    <div class="timeline-header">
      <p class="timeline-status" role="status">
        <strong>{{ currentStep?.label }}</strong>
        <span v-if="message">{{ message }}</span>
      </p>
      <button
        type="button"
        class="sound-toggle"
        :aria-pressed="muted"
        :aria-label="muted ? 'Activar sonido de avisos' : 'Silenciar sonido de avisos'"
        :title="muted ? 'Activar sonido' : 'Silenciar sonido'"
        @click="toggleSound"
      >
        <i :class="muted ? 'pi pi-volume-off' : 'pi pi-volume-up'" aria-hidden="true" />
      </button>
    </div>

    <div class="timeline-route" :style="{ '--current': currentIndex }">
      <span v-if="!cancelled" class="timeline-basket" aria-hidden="true">
        <i class="pi pi-shopping-bag" />
      </span>
      <ol class="timeline-steps">
        <li
          v-for="(step, index) in steps"
          :key="step.code"
          class="timeline-step"
          :class="[step.state.toLowerCase(), { last: index === steps.length - 1, connecting: step.state === 'CURRENT' && hasNextStep }]"
          :aria-current="step.state === 'CURRENT' ? 'step' : undefined"
        >
          <span class="timeline-marker" aria-hidden="true">
            <i v-if="step.state === 'COMPLETED'" class="pi pi-check" />
            <i v-else-if="step.state === 'CURRENT' && cancelled" class="pi pi-times" />
          </span>
          <span class="timeline-label">{{ step.label }}</span>
          <span class="sr-only">{{ step.state === 'COMPLETED' ? ' (listo)' : step.state === 'CURRENT' ? ' (paso actual)' : ' (pendiente)' }}</span>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.order-timeline {
  --row: 5rem;
  --icon: 2.5rem;
  --marker: 2rem;
  --basket: 1.5rem;
  --pad: 0.75rem;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--status-neutral-soft);
  border-radius: 8px;
  background: #fff;
}

.timeline-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.timeline-status {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  color: #333;
}

.timeline-status strong {
  color: var(--status-success);
}

.cancelled .timeline-status strong {
  color: var(--status-danger);
}

.sound-toggle {
  display: grid;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--status-neutral-soft);
  border-radius: 999px;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.sound-toggle:focus-visible {
  outline: 3px solid var(--status-info);
  outline-offset: 2px;
}

/* Fixed row height keeps the basket position computable, so it never overflows the box. */
.timeline-route {
  position: relative;
  padding-top: var(--pad);
}

.timeline-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline-step {
  position: relative;
  display: grid;
  grid-template-columns: var(--icon) minmax(0, 1fr);
  align-items: center;
  column-gap: 0.85rem;
  height: var(--row);
  color: #64748b;
}

.timeline-marker {
  position: relative;
  z-index: 1;
  display: grid;
  width: var(--marker);
  height: var(--marker);
  place-items: center;
  justify-self: center;
  border: 2px solid transparent;
  border-radius: 999px;
  background: #f1f5f9;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 700;
  transition: background-color 0.5s var(--ease), border-color 0.5s var(--ease), color 0.5s var(--ease);
}

.timeline-step.completed .timeline-marker,
.timeline-step.current .timeline-marker {
  border-color: var(--status-success);
  background: var(--status-success);
  color: #fff;
}

.cancelled .timeline-step.current .timeline-marker {
  border-color: var(--status-danger);
  background: var(--status-danger);
}

.cancelled .timeline-step.upcoming .timeline-marker {
  border-color: var(--status-danger);
  background: var(--status-danger-soft);
  color: var(--status-danger);
}

.timeline-label {
  font-size: 0.9rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.timeline-step.completed .timeline-label {
  color: #334155;
}

.timeline-step.current .timeline-label {
  color: var(--status-success);
  font-weight: 700;
}

.cancelled .timeline-step.current .timeline-label {
  color: var(--status-danger);
}

/* Connector from this step's marker to the next one. */
.timeline-step:not(.last)::after {
  position: absolute;
  top: calc(var(--row) / 2 + var(--marker) / 2);
  left: calc(var(--icon) / 2 - 2px);
  width: 4px;
  height: calc(var(--row) - var(--marker));
  border-radius: 999px;
  background: transparent;
  content: '';
  transition: background-color 0.5s var(--ease);
}

.timeline-step.completed:not(.last)::after {
  background: var(--status-success);
}

.cancelled .timeline-step:not(.last)::after {
  background: transparent;
}

/* The segment that is "connecting" to the next step. */
.timeline-step.connecting:not(.last)::after {
  background-image: linear-gradient(180deg, transparent, var(--status-success) 50%, transparent);
  background-repeat: no-repeat;
  background-size: 100% 70%;
  animation: connect-flow 1.6s var(--ease) infinite;
}

.cancelled .timeline-step.connecting:not(.last)::after {
  background-image: none;
  animation: none;
}

.timeline-basket {
  position: absolute;
  top: calc(var(--pad) + var(--current) * var(--row) + (var(--row) - var(--marker)) / 2);
  left: calc((var(--icon) - var(--marker)) / 2);
  z-index: 2;
  display: grid;
  width: var(--marker);
  height: var(--marker);
  place-items: center;
  border-radius: 999px;
  background: var(--status-success);
  color: #fff;
  font-size: 0.9rem;
  transition: top 0.9s var(--ease);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@keyframes connect-flow {
  0% { background-position: 0 -70%; }
  100% { background-position: 0 170%; }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-step.connecting:not(.last)::after {
    background-position: 0 50%;
    animation: none;
  }

  .timeline-basket,
  .timeline-marker,
  .timeline-step:not(.last)::after {
    transition: none;
  }
}
</style>
