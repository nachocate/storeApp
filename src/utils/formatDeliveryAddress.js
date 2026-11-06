export const formatDeliveryAddress = ({ address, locality, notes }) =>
  [address, locality, notes]
    .map((part) => typeof part === 'string' ? part.trim() : '')
    .filter(Boolean)
    .join(', ')