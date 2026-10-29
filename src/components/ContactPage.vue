<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { getVendorInquiryErrorMessage, submitVendorInquiry } from '../api/vendorInquiries.js'
import {
  CONTACT_FIELD_LIMITS,
  createEmptyContactRequest,
  validateContactRequest
} from '../utils/contactRequest.js'
import TiendarioHeader from './TiendarioHeader.vue'

const PLAN_FEATURES = [
  'Tienda online con tu logo, tus colores y dirección propia',
  'Catálogo con variantes, stock y promociones',
  'Carrito y checkout con pagos por Mercado Pago',
  'Seguimiento de pedidos para tus clientes',
  'Panel para administrar productos y ventas'
]

const form = reactive(createEmptyContactRequest())
const touched = reactive({ name: false, phone: false, email: false, message: false })
const submitAttempted = ref(false)
const submitStatus = ref('idle')
const submitError = ref('')
const honeypot = ref('')
const formElement = ref(null)

const isSending = computed(() => submitStatus.value === 'sending')

const errors = computed(() => validateContactRequest(form))
const messageLength = computed(() => form.message.trim().length)

const getFieldError = (field) =>
  touched[field] || submitAttempted.value ? errors.value[field] ?? '' : ''

const markTouched = (field) => {
  touched[field] = true
}

const fieldAttributes = (field) => {
  const error = getFieldError(field)
  return {
    id: `contact-${field}`,
    name: field,
    invalid: Boolean(error),
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': error ? `contact-${field}-error` : undefined
  }
}

const resetForm = () => {
  Object.assign(form, createEmptyContactRequest())
  Object.keys(touched).forEach((field) => { touched[field] = false })
  submitAttempted.value = false
}

const submitContactRequest = async () => {
  if (isSending.value) return

  submitAttempted.value = true
  submitStatus.value = 'idle'

  if (Object.keys(errors.value).length > 0) {
    await nextTick()
    formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  // Bots fill the hidden field; pretend success without sending anything.
  if (honeypot.value) {
    resetForm()
    submitStatus.value = 'sent'
    return
  }

  submitStatus.value = 'sending'
  try {
    await submitVendorInquiry({ ...form })
    resetForm()
    submitStatus.value = 'sent'
  } catch (error) {
    submitError.value = getVendorInquiryErrorMessage(error)
    submitStatus.value = 'error'
  }
}
</script>

<template>
  <main class="tiendario-site contact-page">
    <TiendarioHeader />

    <div class="contact-layout">
      <section class="contact-intro" aria-labelledby="contact-title">
        <div class="contact-intro-shade" aria-hidden="true"></div>
        <div class="contact-intro-content">
          <p class="contact-eyebrow">Plan Tiendario</p>
          <h1 id="contact-title">Tu tienda online, lista para vender</h1>
          <p class="contact-lead">
            Un único plan mensual con todo lo que necesitás para llevar tu comercio a internet.
            Nosotros nos ocupamos de la tecnología para que vos te enfoques en vender.
          </p>

          <ul class="plan-features">
            <li v-for="feature in PLAN_FEATURES" :key="feature">
              <i class="pi pi-check" aria-hidden="true"></i>
              <span>{{ feature }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="contact-form-card" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title">Contanos sobre tu tienda</h2>
        <p class="contact-form-help">Todos los campos son obligatorios.</p>

        <form ref="formElement" class="contact-form" novalidate @submit.prevent="submitContactRequest">
          <div class="contact-field">
            <label for="contact-name">Nombre</label>
            <InputText
              v-model="form.name"
              v-bind="fieldAttributes('name')"
              autocomplete="name"
              :maxlength="CONTACT_FIELD_LIMITS.name"
              @blur="markTouched('name')"
            />
            <small v-if="getFieldError('name')" id="contact-name-error" class="contact-field-error">
              {{ getFieldError('name') }}
            </small>
          </div>

          <div class="contact-field-row">
            <div class="contact-field">
              <label for="contact-phone">Teléfono</label>
              <InputText
                v-model="form.phone"
                v-bind="fieldAttributes('phone')"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="+54 9 11 1234-5678"
                :maxlength="CONTACT_FIELD_LIMITS.phone"
                @blur="markTouched('phone')"
              />
              <small v-if="getFieldError('phone')" id="contact-phone-error" class="contact-field-error">
                {{ getFieldError('phone') }}
              </small>
            </div>

            <div class="contact-field">
              <label for="contact-email">Correo electrónico</label>
              <InputText
                v-model="form.email"
                v-bind="fieldAttributes('email')"
                type="email"
                autocomplete="email"
                placeholder="nombre@correo.com"
                :maxlength="CONTACT_FIELD_LIMITS.email"
                @blur="markTouched('email')"
              />
              <small v-if="getFieldError('email')" id="contact-email-error" class="contact-field-error">
                {{ getFieldError('email') }}
              </small>
            </div>
          </div>

          <div class="contact-field">
            <div class="contact-label-row">
              <label for="contact-message">Tu consulta</label>
              <span class="contact-counter" aria-live="polite">
                {{ messageLength }}/{{ CONTACT_FIELD_LIMITS.message }}
              </span>
            </div>
            <Textarea
              v-model="form.message"
              v-bind="fieldAttributes('message')"
              rows="6"
              auto-resize
              placeholder="¿Qué vendés, dónde está tu comercio y qué te gustaría mejorar?"
              :maxlength="CONTACT_FIELD_LIMITS.message"
              @blur="markTouched('message')"
            />
            <small v-if="getFieldError('message')" id="contact-message-error" class="contact-field-error">
              {{ getFieldError('message') }}
            </small>
          </div>

          <div class="contact-honeypot" aria-hidden="true">
            <label for="contact-honey">No completar este campo</label>
            <input id="contact-honey" v-model="honeypot" type="text" name="_honey" tabindex="-1" autocomplete="off" />
          </div>

          <Message v-if="submitStatus === 'sent'" severity="success" :closable="false" class="contact-status" role="status">
            ¡Gracias! Recibimos tu consulta y te vamos a contactar a la brevedad.
          </Message>
          <Message v-else-if="submitStatus === 'error'" severity="error" :closable="false" class="contact-status" role="alert">
            {{ submitError }}
          </Message>

          <Button
            type="submit"
            :label="isSending ? 'Enviando…' : 'Enviar consulta'"
            :icon="isSending ? 'pi pi-spin pi-spinner' : 'pi pi-send'"
            icon-pos="right"
            :disabled="isSending"
            :aria-busy="isSending ? 'true' : 'false'"
            class="tiendario-button tiendario-button--primary contact-submit"
          />
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.contact-layout {
  display: grid;
  flex: 1 0 auto;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 2rem);
  align-items: stretch;
}

.contact-intro {
  position: relative;
  display: flex;
  align-items: center;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(2rem, 5vw, 4rem);
  border-radius: 20px;
  background: var(--tiendario-secondary);
  color: var(--paper);
}

.contact-intro-shade {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    radial-gradient(ellipse at 85% 10%, rgb(255 255 255 / 24%), transparent 40%),
    radial-gradient(ellipse at 10% 100%, rgb(0 0 0 / 16%), transparent 45%);
  pointer-events: none;
}

.contact-intro-content {
  display: grid;
  gap: 1.5rem;
  max-width: 34rem;
}

.contact-eyebrow {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.contact-intro h1 {
  margin: 0;
  font-size: clamp(2.2rem, 4vw, 3.4rem);
  font-weight: 700;
  line-height: 1.02;
}

.contact-lead {
  margin: 0;
  line-height: 1.6;
}

.plan-features {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  line-height: 1.4;
}

.plan-features .pi {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--paper);
  color: var(--tiendario-secondary);
  font-size: 0.7rem;
  font-weight: 800;
}

.contact-callout {
  padding: 1.25rem;
  border: 1px solid rgb(250 250 250 / 28%);
  border-radius: 16px;
  background: rgb(250 250 250 / 10%);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.contact-callout h2 {
  margin: 0 0 0.4rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.contact-callout p {
  margin: 0;
  line-height: 1.5;
}

.contact-intro a {
  color: inherit;
  font-weight: 700;
  text-underline-offset: 0.2em;
}

.contact-intro a:focus-visible {
  border-radius: 0.2rem;
  outline: 2px solid var(--paper);
  outline-offset: 2px;
}

.contact-form-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 3rem);
  border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 18px 50px rgb(38 38 38 / 8%);
}

.contact-form-card h2 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.contact-form-help {
  margin: 0.4rem 0 1.5rem;
  color: color-mix(in srgb, var(--ink) 75%, transparent);
  font-size: 0.9rem;
}

.contact-form {
  display: grid;
  gap: 1.1rem;
}

.contact-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.1rem;
}

.contact-field {
  display: grid;
  gap: 0.4rem;
}

.contact-field label {
  font-size: 0.9rem;
  font-weight: 700;
}

.contact-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.contact-counter {
  color: color-mix(in srgb, var(--ink) 70%, transparent);
  font-size: 0.8rem;
}

.contact-field :deep(.p-inputtext),
.contact-field :deep(.p-textarea) {
  width: 100%;
  border-radius: 12px;
  font-family: inherit;
}

.contact-field :deep(.p-inputtext:enabled:focus),
.contact-field :deep(.p-textarea:enabled:focus) {
  border-color: var(--tiendario-secondary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tiendario-secondary) 22%, transparent);
}

.contact-field-error {
  color: #b42318;
  font-size: 0.82rem;
  font-weight: 600;
}

.contact-honeypot {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.contact-page .contact-submit {
  justify-self: start;
  min-width: 12rem;
}

@media (max-width: 900px) {
  .contact-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .contact-field-row {
    grid-template-columns: 1fr;
  }

  .contact-page .contact-submit {
    width: 100%;
    justify-self: stretch;
  }
}
</style>
