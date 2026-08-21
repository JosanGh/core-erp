import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/useAuth';
import { usePosStore } from '../../store/usePosStore';
import { ProductModal } from './ProductModal';
import type { PaymentMethod } from '../../types/inventory';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';

export const PosInterface: React.FC = () => {
  const { profile, organization } = useAuth();
  const {
    products,
    cart,
    searchTerm,
    loading,
    discount,
    fetchProducts,
    setSearchTerm,
    addToCart,
    removeFromCart,
    updateQuantity,
    setDiscount,
    clearCart,
    processCheckout,
  } = usePosStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle barcode auto-add on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      const match = products.find(
        (p) => p.sku_barcode?.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      if (match) {
        addToCart(match);
        setSearchTerm('');
      }
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku_barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const finalTotal = Math.max(0, subtotal - discount);
  const changeGiven = Math.max(0, (parseFloat(amountPaid) || 0) - finalTotal);

  const handleCompleteSale = async () => {
    if (!profile || !organization) return;
    setCheckoutError(null);
    setCheckoutSuccess(null);
    setIsSubmitting(true);

    const numericAmountPaid = parseFloat(amountPaid) || finalTotal;

    const res = await processCheckout({
      cashierId: profile.id,
      orgId: organization.id,
      paymentMethod,
      amountPaid: numericAmountPaid,
      discount,
      customerName: customerName || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setCheckoutSuccess(`Sale completed successfully! Transaction ID: ${res.transactionId}`);
      setAmountPaid('');
      setCustomerName('');
      setTimeout(() => setCheckoutSuccess(null), 5000);
    } else {
      setCheckoutError(res.error || 'Failed to complete transaction.');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* LEFT AREA: PRODUCT CATALOG & SEARCH */}
      <div className="flex flex-1 flex-col border-r border-slate-800">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by product name or barcode..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts()}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh inventory"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <PackagePlus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <p className="text-sm">No products found matching "{searchTerm}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-left hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 line-clamp-2">
                      {product.name}
                    </h4>
                    {product.sku_barcode && (
                      <span className="mt-1 block text-[10px] font-mono text-slate-500">
                        {product.sku_barcode}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400 capitalize">{product.unit_of_measure}</span>
                    <span className="text-sm font-bold text-emerald-400">
                      ${product.selling_price.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: CART & CHECKOUT PANEL */}
      <div className="w-96 flex flex-col bg-slate-900 border-l border-slate-800">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">Current Cart</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-red-400 hover:text-red-300"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Notifications */}
        {checkoutSuccess && (
          <div className="m-3 p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{checkoutSuccess}</span>
          </div>
        )}
        {checkoutError && (
          <div className="m-3 p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-xs text-red-300">
            {checkoutError}
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-500 text-center">
              <ShoppingCart className="h-10 w-10 opacity-20 mb-2" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs text-slate-600 mt-0.5">Click or scan items to start a sale</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3"
              >
                <div className="flex-1 pr-2">
                  <h5 className="text-xs font-semibold text-slate-200 line-clamp-1">
                    {item.product.name}
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ${item.unit_price.toFixed(2)} × {item.quantity}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="rounded-md border border-slate-800 bg-slate-900 p-1 text-slate-400 hover:text-white"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="rounded-md border border-slate-800 bg-slate-900 p-1 text-slate-400 hover:text-white"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="rounded-md p-1 text-red-400 hover:bg-red-950/40 ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Calculation Footer */}
        <div className="border-t border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-semibold text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Discount ($)</span>
              <input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-20 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-right text-xs text-white focus:outline-none"
              />
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
              <span>Total Due</span>
              <span className="text-emerald-400">${finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'mobile_money', label: 'MoMo', icon: Smartphone },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === id
                      ? 'border-blue-500 bg-blue-600/10 text-blue-400'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4 mb-1" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Received Input */}
          <div className="flex gap-2">
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Amount Received ($${finalTotal.toFixed(2)})`}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
            {parseFloat(amountPaid) > finalTotal && (
              <div className="flex items-center px-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                Change: ${changeGiven.toFixed(2)}
              </div>
            )}
          </div>

          {/* Complete Checkout Button */}
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-950/50"
          >
            {isSubmitting ? 'Processing Transaction...' : `Charge $${finalTotal.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Product Creation Modal */}
      <ProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};