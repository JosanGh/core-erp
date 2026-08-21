declare module '@paystack/inline-js' {
  interface PaystackTransaction {
    key: string;
    email: string;
    amount: number;
    currency: string;
    ref?: string;
    onSuccess: (transaction: { reference: string }) => void | Promise<void>;
    onCancel: () => void;
  }

  export default class PaystackPop {
    newTransaction(options: PaystackTransaction): void;
  }
}
