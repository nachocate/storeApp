import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import SiteFooter from './SiteFooter.vue'

describe('SiteFooter', () => {
  it('credits CONCAT Studio with a safe external link', () => {
    const container = document.createElement('div')
    createApp(SiteFooter).mount(container)

    const link = container.querySelector('footer a')

    expect(container.querySelector('footer').textContent).toContain('Desarrollado por CONCAT Studio')
    expect(link.getAttribute('href')).toBe('https://concat-studio-web.vercel.app/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
