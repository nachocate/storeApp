<template>
  <main class="welcome-page">
    <header class="welcome-nav">
      <a class="brand" href="/" aria-label="VitrinApp, inicio">
        <span class="brand-symbol" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 10h18l-1.4-5H4.4L3 10Z" />
            <path d="M5 10v10h14V10M9 20v-6h6v6M3 10c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2" />
          </svg>
        </span>
        <span>Tiendario</span>
      </a>
      <span class="nav-note">Un lugar para el comercio independiente</span>
    </header>

    <section class="welcome-hero" aria-labelledby="welcome-title">
      <div class="hero-photo" role="img" aria-label="Puestos de un mercado local llenos de productos frescos"></div>
      <div class="hero-shade"></div>
      <div class="hero-content">
        <h1 id="welcome-title">Descubrí lo que<br />hace única a tu ciudad</h1>
        <div class="hero-actions">
          <Button
            type="button"
            label="Tiendas que trabajan con nosotros"
            severity="secondary"
            class="button-light"
          />
          <Button
            type="button"
            label="Registrarse"
            severity="secondary"
            outlined
            class="button-outline"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.welcome-page {
  --ink: #202c25;
  --paper: #f6f5ef;
  min-height: 100vh;
  padding: 0 clamp(1.25rem, 5vw, 5rem);
  background: var(--paper);
  color: var(--ink);
  font-family: 'Montserrat', sans-serif;
}

.welcome-nav {
  display: flex;
  min-height: 5.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--ink);
  font-size: 1.4rem;
  font-weight: 700;
  text-decoration: none;
}

.brand-symbol {
  display: grid;
  width: 2rem;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 7px;
  background: #df6847;
  color: white;
}

.brand-symbol svg {
  width: 1.3rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.nav-note {
  color: #68736b;
  font-size: 0.78rem;
}

.welcome-hero {
  position: relative;
  display: flex;
  min-height: min(80vh, 680px);
  align-items: center;
  overflow: hidden;
  background: #32463c;
  color: #fff;
  border-radius: 20px;
}

.hero-photo,
.hero-shade {
  position: absolute;
  inset: 0;
}

.hero-photo {
  background-image: url('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=2200&q=85');
  background-position: center 54%;
  background-size: cover;
  transform: scale(1.01);
}

.hero-shade {
  background: linear-gradient(90deg, rgba(18, 34, 26, 0.84) 0%, rgba(18, 34, 26, 0.66) 45%, rgba(18, 34, 26, 0.12) 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  width: min(760px, 78%);
  padding: clamp(3rem, 8vw, 7rem);
  animation: arrive 650ms ease-out both;
}

.hero-content h1 {
  max-width: 15ch;
  margin: 0;
  font-size: 4rem;
  font-weight: 700;
  line-height: 0.99;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 2rem;
}

.hero-actions :deep(.p-button) {
  min-height: 3.1rem;
  border-radius: 20px;
  font-size: 0.86rem;
  font-weight: 700;
}

.hero-actions :deep(.button-light) {
  background: #f6f5ef;
  border-color: #f6f5ef;
  color: #26372d;
}

.hero-actions :deep(.button-outline) {
  border-color: rgba(255, 255, 255, 0.72);
  background: transparent;
  color: white;
}

.hero-actions :deep(.p-button:hover) {
  filter: brightness(0.92);
}

.hero-actions :deep(.p-button:focus-visible),
.brand:focus-visible {
  outline: 3px solid #efb879;
  outline-offset: 4px;
}

@keyframes arrive {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .welcome-page {
    padding: 0 1rem;
  }

  .welcome-nav {
    min-height: 4.5rem;
  }

  .nav-note {
    max-width: 10rem;
    text-align: right;
  }

  .welcome-hero {
    min-height: 65vh;
  }

  .hero-photo {
    background-position: 58% center;
  }

  .hero-shade {
    background: linear-gradient(90deg, rgba(18, 34, 26, 0.84), rgba(18, 34, 26, 0.42));
  }

  .hero-content {
    width: 100%;
    padding: 2rem 1.25rem 4rem;
  }

  .hero-content h1 {
    font-size: 2.5rem;
  }

  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-actions :deep(.p-button) {
    width: 100%;
  }

}

@media (prefers-reduced-motion: reduce) {
  .hero-content {
    animation: none;
  }
}
</style>