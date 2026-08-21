import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Minus, Plus, Search, ShoppingCart, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

type PaymentMethod = 'cash' | 'card' | 'mobile_money';
interface RetailProduct { id: string; org_id: string; sku: string; name: string; unit_price: number; stock_quantity: number; }
interface CartLine { product: RetailProduct; quantity: number; }
interface CompletedSale { receipt: string; customerName: string; paymentMethod: PaymentMethod; total: number; change: number; lines: CartLine[]; }
const LOCAL_PRODUCTS_KEY = 'core-erp-retail-products';
const LOCAL_SALES_KEY = 'core-erp-retail-sales';

export const RetailCheckout = () => {
  const { user, profile, organization } = useAuth();
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showProduct, setShowProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', price: '', stock: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      if (isSupabaseConfigured) {
        const { data, error: queryError } = await supabase.from('retail_products').select('*').eq('org_id', organization.id).order('name');
        if (queryError) setError(queryError.message); else setProducts((data as RetailProduct[]) ?? []);
      } else {
        const local = JSON.parse(localStorage.getItem(LOCAL_PRODUCTS_KEY) || '[]') as RetailProduct[];
        setProducts(local.filter((product) => product.org_id === organization.id));
      }
    };
    void load();
  }, [organization]);

  const visibleProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const subtotal = cart.reduce((sum, line) => sum + line.product.unit_price * line.quantity, 0);
  const change = Math.max(0, (Number(amountPaid) || 0) - subtotal);

  useEffect(() => {
    const successElement = document.querySelector('.retail-pos .success-message');
    if (!successElement || !completedSale || successElement.querySelector('.document-actions')) return;
    const actions = document.createElement('span');
    actions.className = 'document-actions';
    for (const kind of ['Receipt', 'Invoice'] as const) {
      const button = document.createElement('button');
      button.className = 'secondary-button compact';
      button.type = 'button';
      button.textContent = `Print ${kind}`;
      button.onclick = () => {
        const printWindow = window.open('', '_blank', 'width=680,height=760');
        if (!printWindow || !organization) return;
        const lines = completedSale.lines.map((line) => `<tr><td>${line.product.name}</td><td>${line.quantity}</td><td>GHS ${(line.product.unit_price * line.quantity).toFixed(2)}</td></tr>`).join('');
        printWindow.document.write(`<html><head><title>${kind} ${completedSale.receipt}</title><style>body{font:14px sans-serif;padding:32px;color:#172235}h1{font-size:22px;margin:0 0 4px}p{color:#5d6b7d}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:8px 0;border-bottom:1px solid #d7e1ec}td:last-child{text-align:right}.total{font-weight:700;text-align:right;margin-top:18px}</style></head><body><h1>${organization.name}</h1><p>${organization.address ?? ''}</p><h2>${kind}</h2><p>Reference: ${completedSale.receipt}<br>Customer: ${completedSale.customerName || 'Walk-in customer'}<br>Payment: ${completedSale.paymentMethod.replace('_', ' ')}</p><table>${lines}</table><p class="total">Total: GHS ${completedSale.total.toFixed(2)}${completedSale.change > 0 ? `<br>Change: GHS ${completedSale.change.toFixed(2)}` : ''}</p></body></html>`);
        printWindow.document.close(); printWindow.focus(); printWindow.print();
      };
      actions.appendChild(button);
    }
    successElement.appendChild(actions);
    return () => actions.remove();
  }, [completedSale, organization]);

  const addToCart = (product: RetailProduct) => setCart((current) => { const existing = current.find((line) => line.product.id === product.id); if (existing) return current.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(product.stock_quantity, line.quantity + 1) } : line); return [...current, { product, quantity: 1 }]; });
  const updateQuantity = (id: string, quantity: number) => setCart((current) => quantity <= 0 ? current.filter((line) => line.product.id !== id) : current.map((line) => line.product.id === id ? { ...line, quantity } : line));

  const createProduct = async () => {
    if (!organization || !newProduct.name.trim() || !newProduct.sku.trim() || Number(newProduct.price) < 0) return;
    const product: RetailProduct = { id: crypto.randomUUID(), org_id: organization.id, name: newProduct.name.trim(), sku: newProduct.sku.trim(), unit_price: Number(newProduct.price), stock_quantity: Number(newProduct.stock) || 0 };
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase.from('retail_products').insert({ ...product, id: undefined }).select().single();
      if (insertError) { setError(insertError.message); return; }
      setProducts((current) => [...current, data as RetailProduct]);
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_PRODUCTS_KEY) || '[]') as RetailProduct[];
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify([product, ...existing])); setProducts((current) => [...current, product]);
    }
    setNewProduct({ name: '', sku: '', price: '', stock: '' }); setShowProduct(false);
  };

  const completeSale = async () => {
    if (!organization || cart.length === 0) return;
    if (paymentMethod === 'cash' && Number(amountPaid) < subtotal) { setError('Amount received is less than the total due.'); return; }
    setError(null); setSuccess(null);
    const receipt = `POS-${Date.now().toString().slice(-8)}`;
    if (isSupabaseConfigured) {
      const { error: saleError } = await supabase.from('sales_transactions').insert({ org_id: organization.id, receipt_number: receipt, total: subtotal, payment_method: paymentMethod, created_by: user?.id });
      if (saleError) { setError(saleError.message); return; }
      for (const line of cart) await supabase.from('retail_products').update({ stock_quantity: Math.max(0, line.product.stock_quantity - line.quantity) }).eq('id', line.product.id).eq('org_id', organization.id);
    } else {
      const sales = JSON.parse(localStorage.getItem(LOCAL_SALES_KEY) || '[]') as unknown[];
      localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify([{ receipt, org_id: organization.id, total: subtotal, payment_method: paymentMethod, customer_name: customerName, created_at: new Date().toISOString() }, ...sales]));
      setProducts((current) => current.map((product) => { const line = cart.find((item) => item.product.id === product.id); return line ? { ...product, stock_quantity: Math.max(0, product.stock_quantity - line.quantity) } : product; }));
    }
    await logAuditEvent({ orgId: organization.id, module: 'pos', action: 'SALE_COMPLETED', targetResource: receipt, details: { total: subtotal, payment_method: paymentMethod, customer_name: customerName || undefined }, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
    setCompletedSale({ receipt, customerName, paymentMethod, total: subtotal, change, lines: cart });
    setCart([]); setAmountPaid(''); setCustomerName(''); setSuccess(`Sale ${receipt} completed. Change: GHS ${change.toFixed(2)}`);
  };

  return <section className="workspace-content retail-pos"><div className="section-heading"><div><span className="eyebrow">Supermarket checkout</span><h2>Retail POS</h2><p>Fast checkout for supermarket sales, stock control, and Ghana cedi payments.</p></div><button className="primary-button compact" onClick={() => setShowProduct(true)}><Plus size={16} /> Add product</button></div><div className="pos-layout"><div className="pos-catalog"><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or SKU" /></div></div><div className="pos-product-grid">{visibleProducts.length === 0 ? <div className="empty-state"><ShoppingCart size={25} /><strong>No products found</strong><p>Add a product to begin selling.</p></div> : visibleProducts.map((product) => <button className="pos-product" key={product.id} onClick={() => addToCart(product)} disabled={product.stock_quantity <= 0}><strong>{product.name}</strong><small>{product.sku} · {product.stock_quantity} in stock</small><b>GHS {product.unit_price.toFixed(2)}</b></button>)}</div></div><aside className="pos-cart"><div className="panel-heading"><span><ShoppingCart size={17} /> Current cart</span><button onClick={() => setCart([])}>Clear</button></div><div className="pos-cart-lines">{cart.length === 0 ? <div className="empty-state"><ShoppingCart size={22} /><span>Cart is empty</span></div> : cart.map((line) => <div className="pos-line" key={line.product.id}><div><strong>{line.product.name}</strong><small>GHS {line.product.unit_price.toFixed(2)}</small></div><div className="quantity-control"><button onClick={() => updateQuantity(line.product.id, line.quantity - 1)}><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.product.id, line.quantity + 1)}><Plus size={13} /></button><button onClick={() => updateQuantity(line.product.id, 0)}><Trash2 size={13} /></button></div></div>)}</div><div className="pos-total"><span>Total due</span><strong>GHS {subtotal.toFixed(2)}</strong></div><label>Customer name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Optional" /></label><div className="payment-options">{(['cash', 'mobile_money', 'card'] as PaymentMethod[]).map((method) => <button key={method} className={paymentMethod === method ? 'selected' : ''} onClick={() => setPaymentMethod(method)}>{method === 'cash' ? <Banknote size={15} /> : method === 'card' ? <CreditCard size={15} /> : <Smartphone size={15} />}{method.replace('_', ' ')}</button>)}</div>{paymentMethod === 'cash' && <label>Amount received<input type="number" min={subtotal} value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} placeholder={subtotal.toFixed(2)} /></label>}{success && <p className="success-message">{success}</p>}{error && <p className="form-error">{error}</p>}<button className="primary-button checkout-button" onClick={() => void completeSale()} disabled={cart.length === 0}>Complete sale</button></aside></div>{showProduct && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Retail catalog</span><h2>Add product</h2></div><button onClick={() => setShowProduct(false)} aria-label="Close dialog">×</button></div><label>Product name<input value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} placeholder="Milo 400g" /></label><label>SKU<input value={newProduct.sku} onChange={(event) => setNewProduct({ ...newProduct, sku: event.target.value })} placeholder="MIL-400" /></label><div className="form-two-column"><label>Price<input type="number" min="0" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} placeholder="25.00" /></label><label>Opening stock<input type="number" min="0" value={newProduct.stock} onChange={(event) => setNewProduct({ ...newProduct, stock: event.target.value })} placeholder="50" /></label></div><button className="primary-button" onClick={() => void createProduct()}><Plus size={16} /> Save product</button></div></div>}</section>;
};
