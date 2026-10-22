# storeApp

Tienda pública creada con Vue 3 y Vite.

## Configuración de la API

El proyecto usa una única variable: `API_BASE_URL`. No existe una URL de API predeterminada en el código. Como se trata de una URL pública, Vite la expone al cliente para resolver imágenes relativas; no guardes secretos bajo nombres que comiencen con `API_`.

Para desarrollo local, copiá `.env.example` como `.env`, configurá `API_BASE_URL` y reiniciá `npm run dev`.

En Cloudflare Workers Builds, definí `API_BASE_URL` con el mismo valor en los dos ámbitos que Cloudflare separa: **Settings → Builds → Build variables** para Vite y **Settings → Variables and Secrets** para el Worker en tiempo de ejecución.

Para diagnosticar el proxy temporalmente, definí `API_PROXY_LOGGING` con el valor `true` en **Variables and Secrets**. Los logs registran método, ruta, endpoint upstream, estado y duración, sin incluir tokens, cuerpos ni query params. Quitá o cambiá esta variable al terminar el diagnóstico.

El Worker definido en `worker/index.js` sirve los archivos de `dist`, mantiene el fallback de Vue para rutas como `/:storeSlug` y reenvía las solicitudes de la tienda al backend en el mismo origen, por lo que no es necesario abrir CORS. `keep_vars` conserva las variables configuradas desde Cloudflare entre deploys. En Cloudflare Workers Builds, usá `npm run build` como comando de build, `npx wrangler deploy --config wrangler.jsonc` como comando de deploy y `npx wrangler preview --config wrangler.jsonc` como comando de preview.

## Checkout con Mercado Pago

El storefront consulta `checkout-options` para mostrar Mercado Pago sólo cuando la API lo habilita para la modalidad seleccionada. El backend debe crear la preferencia de Checkout Pro, devolver `mercadoPagoCheckoutUrl` y `orderTrackingToken` en el checkout, y confirmar el pedido únicamente desde su webhook validado. No configures credenciales de Mercado Pago en Vite ni en este repositorio.

Cada tienda se sirve en un subdominio: `https://{storeSlug}.tiendario.cloud/` (rama de producción) o `https://{storeSlug}-dev.tiendario.cloud/` (rama `dev`; el sufijo `-dev` se descarta para obtener el slug real). Un slug de producción que termine en `-dev` no es distinguible de un subdominio de desarrollo. El dominio base se puede cambiar con `VITE_BASE_DOMAIN` (por defecto `tiendario.cloud`); requiere un DNS/ruta wildcard `*.{dominio base}` apuntando a la app. Los subdominios `www` y `dev` están reservados (`dev.tiendario.cloud` muestra la home). En hosts fuera del dominio base (por ejemplo `localhost`) se mantiene el ruteo por ruta `/{storeSlug}`.

Antes de probar el flujo, configurá en el backend el retorno de Checkout Pro a la ruta de seguimiento de la tienda (`https://{storeSlug}.{dominio base}/orders/{orderId}`); el storefront guarda el token antes de redirigir y consulta el estado mediante la API/SSE al volver. Probá primero con cuentas de prueba de Mercado Pago y una tienda vinculada a una cuenta vendedora de prueba.


## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
