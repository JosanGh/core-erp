import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Product, CartItem, CheckoutParams } from '../types/inventory';

interface PosState {
  products: Product[];
  cart: CartItem[];
  searchTerm: string;
  loading: boolean;
  error: string | null;
  discount: number;
  taxRate: number; // e.g. 0.0 for 0%, 0.15 for 15%

  // Actions
  fetchProducts: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setDiscount: (amount: number) => void;
  clearCart: () => void;
  processCheckout: (params: CheckoutParams) => Promise<{ success: boolean; transactionId?: string; error?: string }>;
}

export const usePosStore = create<PosState>((set, get) => ({
  products: [],
  cart: [],
  searchTerm: '',
  loading: false,
  error: null,
  discount: 0,
  taxRate: 0.0,

  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      set({ products: (data as Product[]) || [], loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setSearchTerm: (term: string) => set({ searchTerm: term }),

  addToCart: (product: Product, quantity = 1) => {
    const { cart } = get();
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].quantity + quantity;
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: newQty,
        total_price: newQty * product.selling_price,
      };
      set({ cart: updatedCart });
    } else {
      set({
        cart: [
          ...cart,
          {
            product,
            quantity,
            unit_price: product.selling_price,
            total_price: quantity * product.selling_price,
          },
        ],
      });
    }
  },

  removeFromCart: (productId: string) => {
    set({ cart: get().cart.filter((item) => item.product.id !== productId) });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    const updatedCart = get().cart.map((item) => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity,
          total_price: quantity * item.unit_price,
        };
      }
      return item;
    });
    set({ cart: updatedCart });
  },

  setDiscount: (amount: number) => set({ discount: Math.max(0, amount) }),

  clearCart: () => set({ cart: [], discount: 0 }),

  processCheckout: async ({
    cashierId,
    orgId,
    paymentMethod,
    amountPaid,
    discount = 0,
    customerName,
    customerPhone,
    notes,
  }: CheckoutParams) => {
    const { cart, taxRate } = get();
    if (cart.length === 0) return { success: false, error: 'Cart is empty.' };

    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const tax = subtotal * taxRate;
    const totalAmount = Math.max(0, subtotal - discount + tax);
    const changeGiven = Math.max(0, amountPaid - totalAmount);

    try {
      // 1. Insert master transaction record
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          org_id: orgId,
          cashier_id: cashierId,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          transaction_type: 'sale',
          payment_method: paymentMethod,
          subtotal,
          discount,
          tax,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          change_given: changeGiven,
          status: 'completed',
          notes,
        })
        .select('id')
        .single();

      if (txError) throw txError;

      // 2. Prepare line items
      const lineItems = cart.map((item) => ({
        org_id: orgId,
        transaction_id: txData.id,
        product_id: item.product.id,
        batch_id: item.batch_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      // 3. Insert transaction line items (triggers stock deduction automatically)
      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(lineItems);

      if (itemsError) throw itemsError;

      // Reset cart on success
      get().clearCart();
      return { success: true, transactionId: txData.id };
    } catch (err: any) {
      console.error('Checkout error:', err);
      return { success: false, error: err.message };
    }
  },
}));