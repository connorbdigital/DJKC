/**
 * Checkout as a specification, not a screen.
 *
 * The rules encoded here come from the recurring findings in checkout
 * usability research: guest first, the full cost before payment, few fields,
 * wallet buttons above the form, and no account wall. The module returns the
 * flow and audits it, so a redesign cannot quietly reintroduce the friction.
 */
export type PaymentMethod = "card" | "apple-pay" | "google-pay" | "paypal" | "klarna" | "bank-transfer";

export type DeliverySpeed = "standard" | "express" | "collect";

export interface Wallet {
  method: Extract<PaymentMethod, "apple-pay" | "google-pay" | "paypal">;
  /** Rendered above the form, one tap from the basket. */
  express: boolean;
}

export interface CheckoutConfig {
  /** Account creation must never be required to pay. */
  account: "guest" | "optional" | "required";
  wallets: Wallet[];
  methods: PaymentMethod[];
  delivery: { speed: DeliverySpeed; label: string; estimate: string; priceMinor: number }[];
  /** Address lookup by postcode, instead of six manual fields. */
  addressLookup: boolean;
  /** Newsletter opt-in presented as an unticked box, never a pre-ticked one. */
  marketingOptIn: "unticked" | "preselected" | "absent";
}

export interface Step {
  id: "contact" | "delivery" | "payment" | "review";
  title: string;
  /** What the shopper sees on this step that they cannot see later. */
  showsTotal: boolean;
  fields: FieldSpec[];
}

export interface FieldSpec {
  name: string;
  label: string;
  type: "email" | "tel" | "text" | "select" | "checkbox" | "card";
  /** Autocomplete tokens; every address field should have one. */
  autocomplete?: string;
  required: boolean;
}

/**
 * The minimum credible set. Twelve form elements is the ceiling Baymard's
 * testing suggests is achievable; most live checkouts show over twenty.
 */
export const FIELDS = {
  email: { name: "email", label: "Email", type: "email", autocomplete: "email", required: true },
  name: { name: "name", label: "Full name", type: "text", autocomplete: "name", required: true },
  address: { name: "address", label: "Address", type: "text", autocomplete: "street-address", required: true },
  postcode: { name: "postcode", label: "Postcode", type: "text", autocomplete: "postal-code", required: true },
  lookup: { name: "lookup", label: "Find my address", type: "text", autocomplete: "postal-code", required: true },
  phone: { name: "phone", label: "Phone", type: "tel", autocomplete: "tel", required: false },
  card: { name: "card", label: "Card", type: "card", autocomplete: "cc-number", required: true },
  terms: { name: "terms", label: "I accept the terms", type: "checkbox", required: true },
} satisfies Record<string, FieldSpec>;

export const FORM_ELEMENT_BUDGET = 12;

/** Guest-first, total-first, wallet-first — in that order. */
export function checkoutFlow(config: CheckoutConfig): Step[] {
  const postcodeFirst = config.addressLookup;
  const deliveryFields: FieldSpec[] = postcodeFirst
    ? [FIELDS.name, FIELDS.lookup, FIELDS.postcode, FIELDS.phone]
    : [FIELDS.name, FIELDS.address, FIELDS.postcode, FIELDS.phone];

  return [
    {
      id: "contact",
      title: config.account === "guest" ? "Continue as a guest" : "Your details",
      showsTotal: true,
      fields: [FIELDS.email],
    },
    {
      id: "delivery",
      title: "Delivery",
      /* The number here is the point: delivery is priced before payment. */
      showsTotal: true,
      fields: deliveryFields,
    },
    {
      id: "payment",
      title: "Payment",
      showsTotal: true,
      fields: config.methods.includes("card") ? [FIELDS.card, FIELDS.terms] : [FIELDS.terms],
    },
    { id: "review", title: "Review and place order", showsTotal: true, fields: [] },
  ];
}

export const totalFields = (steps: Step[]): number => steps.reduce((count, step) => count + step.fields.length, 0);

export interface FlowIssue {
  rule: string;
  detail: string;
  because: string;
}

/** Audits a proposed checkout against the rules that move conversion. */
export function auditFlow(config: CheckoutConfig): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const steps = checkoutFlow(config);

  if (config.account === "required") {
    issues.push({
      rule: "guest-checkout",
      detail: "checkout requires an account",
      because: "forced registration is one of the largest preventable causes of abandonment",
    });
  }
  if (!steps.some((step) => step.showsTotal)) {
    issues.push({
      rule: "cost-before-payment",
      detail: "the total is not shown before the payment step",
      because: "surprise delivery or tax at the last step is the single most cited reason for walking away",
    });
  }
  if (totalFields(steps) > FORM_ELEMENT_BUDGET) {
    issues.push({
      rule: "field-budget",
      detail: `${totalFields(steps)} form elements, budget is ${FORM_ELEMENT_BUDGET}`,
      because: "length is a usability cost, not a thoroughness signal",
    });
  }
  if (!config.wallets.some((wallet) => wallet.express)) {
    issues.push({
      rule: "express-wallet",
      detail: "no wallet offered above the form",
      because: "one-tap wallets remove the address and card entry entirely for most mobile shoppers",
    });
  }
  if (!config.addressLookup) {
    issues.push({
      rule: "address-lookup",
      detail: "address is typed field by field",
      because: "lookup removes four of the most error-prone fields on mobile",
    });
  }
  if (config.marketingOptIn === "preselected") {
    issues.push({
      rule: "consent",
      detail: "marketing consent is pre-ticked",
      because: "pre-ticked consent is not valid consent under UK GDPR",
    });
  }
  if (!config.methods.includes("card") && !config.methods.some((method) => method === "paypal" || method.startsWith("apple") || method.startsWith("google"))) {
    issues.push({
      rule: "payment-choice",
      detail: "no widely accepted payment method",
      because: "a missing preferred method loses the sale at the last step",
    });
  }
  return issues;
}

/** A sensible default a shop can ship on day one. */
export const defaultCheckout = (): CheckoutConfig => ({
  account: "guest",
  wallets: [
    { method: "apple-pay", express: true },
    { method: "google-pay", express: true },
    { method: "paypal", express: true },
  ],
  methods: ["card", "apple-pay", "google-pay", "paypal"],
  delivery: [
    { speed: "standard", label: "Standard", estimate: "2–3 working days", priceMinor: 0 },
    { speed: "express", label: "Express", estimate: "Next working day", priceMinor: 599 },
    { speed: "collect", label: "Collect in person", estimate: "Ready in 2 hours", priceMinor: 0 },
  ],
  addressLookup: true,
  marketingOptIn: "unticked",
});
