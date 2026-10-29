<script setup>
const STUDIO_URL = 'https://concat-studio-web.vercel.app/'
</script>

<template>
  <footer class="site-footer">
    <p>
      Desarrollado por
      <a :href="STUDIO_URL" target="_blank" rel="noopener noreferrer">CONCAT Studio</a>
    </p>
  </footer>
</template>

<style scoped>
.site-footer {
  width: 100%;
  margin-top: auto;
  padding: 1.25rem 1rem;
  color: var(--background-text-color, var(--ink));
  font-size: 0.8rem;
  text-align: center;
}

.site-footer p {
  margin: 0;
  opacity: 0.75;
}

.site-footer a {
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.2em;
}

.site-footer a:hover {
  text-decoration-thickness: 2px;
}

.site-footer a:focus-visible {
  border-radius: 0.2rem;
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
