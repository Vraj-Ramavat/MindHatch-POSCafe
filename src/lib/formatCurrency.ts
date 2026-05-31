export function formatCurrency(amount: number | null | undefined) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

export default formatCurrency;
