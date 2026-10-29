# Tiendario

Storefront multitienda construida con Vue 3 y Vite. Cada tienda carga su catálogo, configuración, promociones y pedidos desde la API.

## Arquitectura

```text
src/
  App.vue                 Coordinación de vistas y estado general de la tienda
  api/                    Cliente HTTP del storefront
  components/             Presentación y componentes de interfaz
  composables/            Estado y lógica reutilizable de catálogo, carrito y checkout
  config/                 Resolución del slug, dominio y ambiente
  data/                   Valores locales de respaldo
  services/               Integraciones de seguimiento en tiempo real
  utils/                  Formateo, validación y normalización sin interfaz
worker/                   Archivos estáticos y proxy API para Cloudflare
server/                   Proxy y pruebas del servidor
api/                      Rutas API del proyecto
```

### Responsabilidades principales

- `App.vue` resuelve la tienda, carga su configuración y coordina catálogo, carrito, checkout y seguimiento.
- `ProductCatalogSection.vue` presenta estados de carga y error, promociones, la grilla de cards y la paginación. Recibe modelos y emite acciones; el carrito se mantiene en `App.vue`.
- `components/` presenta las vistas. `CheckoutPage.vue` delega su estado y operaciones a `useCheckoutPage.js`; no concentra el flujo de checkout junto al marcado.
- `useProductCatalog.js` contiene búsqueda, filtros, orden, promociones visibles y desplazamiento de categorías.
- `useProductVariants.js` administra disponibilidad y selección de variantes. `useProductCard.js` prepara el precio, la etiqueta y las acciones que necesita la card.
- `useVisitorCart.js` mantiene el carrito y sus operaciones; `useStoreOrders.js` administra pedidos. `api/store.js` centraliza las solicitudes al backend.
- `utils/` contiene funciones puras o adaptadores pequeños; `config/store.js` resuelve el ambiente y la tienda a partir del host o la ruta.

### Flujos principales

1. **Tienda y catálogo:** la aplicación resuelve el slug, carga configuración y productos, y aplica filtros y orden desde el composable de catálogo.
2. **Variantes:** la card muestra el estado agotado si no hay variantes disponibles. Si queda una sola, muestra esa opción y la agrega directamente; con varias, abre la vista para elegirlas.
3. **Carrito y checkout:** el carrito se sincroniza con la API. El checkout obtiene opciones de pago y entrega, ventanas disponibles y cotización antes de confirmar el pedido.
4. **Pedidos:** el seguimiento se actualiza mediante SSE y sincronización con la API. Las operaciones de pedido y comprobantes se delegan a `useStoreOrders.js`.

## Requisitos

- Node.js `^22.18.0` o `>=24.12.0`
- npm
- Una URL HTTP(S) de API configurada como `API_BASE_URL`

## Desarrollo y pruebas

```sh
npm install
```

Copiá `.env.example` como `.env`, configurá `API_BASE_URL` y levantá Vite:

```sh
npm run dev
```

Comandos disponibles:

```sh
npm run build       # Compilación de producción
npm run preview     # Servir localmente la compilación
npm run test        # Suite completa de Vitest
```

Para ejecutar una prueba puntual:

```sh
npm run test -- src/components/ProductCard.test.js
```

No hay un comando de lint configurado actualmente.

## Variables de entorno

`API_BASE_URL` es obligatoria y debe ser una URL HTTP(S) válida. Vite usa esta URL para el proxy de desarrollo; el Worker la usa para reenviar las solicitudes al backend. El prefijo `API_` está incluido en `envPrefix`, por lo que la variable queda disponible en el cliente: debe contener únicamente una URL pública, nunca credenciales ni secretos.

Variables opcionales:

| Variable | Uso | Valor predeterminado |
| --- | --- | --- |
| `VITE_BASE_DOMAIN` | Dominio base de las tiendas por subdominio | `tiendario.cloud` |
| `VITE_DEPLOY_ENV` | Ambiente servido por el build; establecer `dev` en builds de desarrollo | `production` |
| `VITE_ADMIN_URL` | Destino del botón "Mi tienda" en la bienvenida y el contacto | `https://admin-dev.tiendario.cloud/` |
| `VITE_CONTACT_EMAIL` | Correo que recibe vía [formsubmit.io](https://formsubmit.io) las consultas de `/contacto`; el primer envío requiere confirmar la activación desde ese correo | `concat.studio.vt@gmail.com` |
| `VITE_CONTACT_FORM_ID` | Token privado de formsubmit.io (en la configuración de la cuenta) que se usa en lugar del correo para no exponerlo | Correo de contacto |
| `API_PROXY_LOGGING` | Activa logs temporales del proxy en el Worker al usar `true` | Desactivado |

Para diagnosticar el proxy, `API_PROXY_LOGGING=true` registra método, ruta, endpoint upstream, estado y duración, sin tokens, cuerpos ni parámetros de consulta. Desactivalo al terminar.

## Dominios y resolución de tiendas

- Producción usa `https://{storeSlug}.tiendario.cloud/`.
- El build de desarrollo usa `https://{storeSlug}-dev.tiendario.cloud/`; requiere `VITE_DEPLOY_ENV=dev`. El sufijo `-dev` se elimina al resolver el slug.
- Cada build sirve solo su ambiente. Los hosts del ambiente opuesto muestran “Tienda no encontrada”.
- `www` y `dev` son subdominios reservados; `dev.tiendario.cloud` muestra la página de inicio.
- En hosts fuera del dominio base, como `localhost`, la tienda se resuelve por la ruta `/{storeSlug}`.
- Si se cambia `VITE_BASE_DOMAIN`, hace falta configurar un DNS o una ruta wildcard `*.{dominio base}` hacia la aplicación.

## Despliegue en Cloudflare

`worker/index.js` sirve `dist`, mantiene el fallback de la SPA para rutas de tienda y seguimiento, y reenvía `/api/*` al backend en el mismo origen. Por eso, el navegador no necesita acceso CORS directo al backend. `keep_vars` conserva las variables configuradas en Cloudflare entre despliegues.

En **Workers Builds**:

- Build: `npm run build`
- Deploy: `npx wrangler deploy --config wrangler.jsonc`
- Preview: `npx wrangler preview --config wrangler.jsonc`

Configurá `API_BASE_URL` tanto en **Settings → Builds → Build variables** (Vite) como en **Settings → Variables and Secrets** (Worker). Para un build de la rama `dev`, definí también `VITE_DEPLOY_ENV=dev` en las variables de build.

## Checkout y seguimiento de pedidos

El storefront consulta `checkout-options` y muestra Mercado Pago solo si la API lo habilita para la modalidad seleccionada. El backend debe crear la preferencia de Checkout Pro, devolver `mercadoPagoCheckoutUrl` y `orderTrackingToken` al confirmar el checkout, y confirmar el pedido únicamente desde un webhook validado. No configures credenciales de Mercado Pago en Vite ni en este repositorio.

El backend debe devolver `orderId`, `publicOrderId` y `orderTrackingToken`. Antes de redirigir a Mercado Pago, el storefront conserva el token junto al `publicOrderId` en `sessionStorage`; al volver a `/orders/{publicOrderId}`, consulta `GET /orders/current` con `X-Order-Tracking-Token`.

**Compartir pedido** crea un enlace `/orders/{publicOrderId}#trackingToken={token}`. El storefront guarda el token del fragmento en `sessionStorage` y elimina el fragmento de la barra de direcciones inmediatamente; no lo envía como parámetro de consulta. El `publicOrderId` por sí solo no autoriza la lectura: sin un token local o del fragmento, no se consulta la API por ID y se muestra una indicación genérica para abrir el enlace del email o contactar a la tienda. La API de seguimiento debe limitar la respuesta a los datos necesarios y excluir email, teléfono, domicilio y comprobantes. Las acciones autenticadas usan el token en el header.

Antes de probar Mercado Pago, configurá en el backend la URL de retorno a `/orders/{publicOrderId}` en el dominio de la tienda. El retorno no lleva el token en la URL: se recupera de `sessionStorage`. Los enlaces de email incluyen un token de 30 días en el fragmento; la aplicación verifica que el `publicOrderId` de la respuesta coincida con la ruta. Usá cuentas de prueba de Mercado Pago y una tienda vinculada a una cuenta vendedora de prueba.

## Entorno de desarrollo recomendado

- [VS Code](https://code.visualstudio.com/) con [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar); desactivá Vetur.
- Vue Devtools en Chromium o Firefox.
- [Referencia de configuración de Vite](https://vite.dev/config/).
