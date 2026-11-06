const PAYMENT_PROVIDERS = {
  CASH: { label: 'Efectivo', description: 'Al recibir o retirar' },
  TRANSFER: { label: 'Transferencia', description: 'Transferencia bancaria' },
  MERCADO_PAGO: { label: 'Mercado Pago', description: 'Pagá online con Mercado Pago' }
}

export function describePaymentProvider(provider) {
  return PAYMENT_PROVIDERS[provider] ?? { label: provider, description: '' }
}
