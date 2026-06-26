import React, { useState, useEffect, useRef } from 'react';
import { supa } from '../lib/SupabaseClient';
import {
  Shield, Zap, TrendingUp, AlertTriangle,
  ExternalLink, Globe, Filter, ShoppingBag, X,
  Package, Tag, Loader2
} from 'lucide-react';

interface PrintfulProduct {
  id: number; name: string; thumbnail_url: string; variants?: number; external_url?: string;
}
interface PrintfulVariant {
  id: number; name: string; retail_price: string; color?: string; size?: string; availability_status?: string;
}
interface SelectedVariant {
  id: number; price: string; color: string; size: string; available: boolean;
}
interface DomainItem {
  id: number; created_at: string; title: string; body: string; type: string; author_name: string; meta?: any;
}

const PRINTFUL_HUB     = 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/printful-hub';
const PAYPAL_CHECKOUT  = 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/paypal-checkout';
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

function fmt(p: string | number) {
  const n = parseFloat(String(p));
  return isNaN(n) ? 'TBD' : `$${n.toFixed(2)} USD`;
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-64 glass-card p-0 overflow-hidden animate-pulse">
      <div className="w-full h-52 bg-white/5" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-3 bg-white/[0.08] rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="h-8 bg-white/5 rounded mt-1" />
      </div>
    </div>
  );
}

function MerchModal({ product, onClose }: { product: PrintfulProduct; onClose: () => void }) {
  const [variants, setVariants]               = useState<PrintfulVariant[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [selectedColor, setSelectedColor]     = useState<string | null>(null);
  const [selectedSize, setSelectedSize]       = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const [paypalReady, setPaypalReady]         = useState(false);
  const [orderStatus, setOrderStatus]         = useState<'idle'|'processing'|'success'|'error'>('idle');
  const [orderMsg, setOrderMsg]               = useState('');
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalRendered     = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!PAYPAL_CLIENT_ID) return;
    if (document.getElementById('paypal-sdk')) { setPaypalReady(true); return; }
    const s = document.createElement('script');
    s.id  = 'paypal-sdk';
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
    s.onload  = () => setPaypalReady(true);
    s.onerror = () => console.error('PayPal SDK load failed');
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${PRINTFUL_HUB}?action=variants&product_id=${product.id}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setVariants(json?.result?.variants || json?.result || []);
      } catch { setError('Could not load variants. API may be offline.'); }
      finally  { setLoading(false); }
    })();
  }, [product.id]);

  useEffect(() => {
    if (!selectedColor && !selectedSize) { setSelectedVariant(null); return; }
    const match = variants.find(v =>
      (!selectedColor || v.color === selectedColor) &&
      (!selectedSize  || v.size  === selectedSize)
    );
    setSelectedVariant(match ? {
      id: match.id, price: match.retail_price,
      color: match.color || '', size: match.size || '',
      available: match.availability_status !== 'discontinued',
    } : null);
  }, [selectedColor, selectedSize, variants]);

  useEffect(() => {
    if (!paypalReady || !selectedVariant || !paypalContainerRef.current) return;
    if (paypalRendered.current) {
      paypalContainerRef.current.innerHTML = '';
      paypalRendered.current = false;
    }
    const win = window as any;
    if (!win.paypal) return;
    win.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 40 },
      createOrder: async () => {
        setOrderStatus('processing'); setOrderMsg('Initializing payment...');
        const res  = await fetch(PAYPAL_CHECKOUT, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_order', variantId: selectedVariant.id, price: selectedVariant.price }),
        });
        const data = await res.json();
        if (!data.id) throw new Error(data.error || 'Failed to create order');
        setOrderStatus('idle');
        return data.id;
      },
      onApprove: async (data: any) => {
        setOrderStatus('processing'); setOrderMsg('Capturing payment...');
        const res    = await fetch(PAYPAL_CHECKOUT, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'capture_order', paypalOrderId: data.orderID, variantId: selectedVariant.id }),
        });
        const result = await res.json();
        if (result.success) {
          setOrderStatus('success');
          setOrderMsg(`Order #${result.printful_order_id} confirmed! Check your email for tracking.`);
        } else {
          setOrderStatus('error');
          setOrderMsg(result.error || 'Payment captured but fulfillment failed. Contact support.');
        }
      },
      onError:  () => { setOrderStatus('error');  setOrderMsg('Payment failed. Please try again.'); },
      onCancel: () => { setOrderStatus('idle');   setOrderMsg(''); },
    }).render(paypalContainerRef.current);
    paypalRendered.current = true;
  }, [paypalReady, selectedVariant]);

  const colors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
  const sizes  = Array.from(new Set(variants.map(v => v.size).filter(Boolean)))  as string[];
  const availableSizes  = selectedColor
    ? Array.from(new Set(variants.filter(v => v.color === selectedColor).map(v => v.size).filter(Boolean)))  as string[]
    : sizes;
  const availableColors = selectedSize
    ? Array.from(new Set(variants.filter(v => v.size === selectedSize).map(v => v.color).filter(Boolean))) as string[]
    : colors;
  const prices = variants.map(v => parseFloat(v.retail_price)).filter(Boolean);
  const minP   = prices.length ? Math.min(...prices) : null;
  const maxP   = prices.length ? Math.max(...prices) : null;
  const priceDisplay = selectedVariant
    ? fmt(selectedVariant.price)
    : minP != null ? (minP === maxP ? fmt(minP) : `${fmt(minP)} – ${fmt(maxP!)}`) : 'Price TBD';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl glass-card overflow-hidden flex flex-col"
        style={{ animation: 'modalIn 0.28s cubic-bezier(0.2,0.8,0.2,1) forwards', borderColor: 'rgba(0,229,255,0.35)', boxShadow: '0 0 60px rgba(0,229,255,0.12)', maxHeight: '90dvh' }}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-neonPink via-neonCyan to-neonOrange shrink-0" />
        <button onClick={onClose} className="absolute top-4 right-4 z-10 border border-white/10 hover:border-neonPink text-gray-400 hover:text-neonPink w-8 h-8 rounded flex items-center justify-center transition-all">
          <X size={14} />
        </button>

        <div className="overflow-y-auto flex flex-col md:flex-row">
          <div className="md:w-56 shrink-0 bg-[#0a0a14] flex items-center justify-center p-6">
            <img src={product.thumbnail_url} alt={product.name} className="max-h-48 object-contain drop-shadow-2xl"
              onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x200/0c0c1c/444?text=MERCH'; }} />
          </div>

          <div className="flex-1 p-6 flex flex-col gap-3">
            <span className="border border-neonCyan/40 bg-neonCyan/5 text-neonCyan text-[9px] font-bold tracking-widest px-2 py-0.5 rounded font-orbitron uppercase w-fit">Official Merch</span>
            <h3 className="font-orbitron font-extrabold text-lg text-white tracking-wide uppercase leading-snug">{product.name}</h3>
            <div className="font-orbitron font-bold text-2xl text-neonOrange transition-all">{priceDisplay}</div>

            {loading && <div className="flex items-center gap-3 text-gray-500 text-xs font-bold font-orbitron uppercase tracking-wider py-2"><Loader2 size={16} className="animate-spin text-neonCyan" />Loading variants...</div>}
            {error   && <div className="border border-neonPink/30 bg-neonPink/5 rounded p-3 text-[10px] text-neonPink font-bold font-orbitron uppercase tracking-wider flex items-start gap-2"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{error}</div>}

            {!loading && !error && (
              <>
                {colors.length > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-orbitron mb-2 block">Color</span>
                    <div className="flex flex-wrap gap-2">
                      {colors.map(c => {
                        const avail = availableColors.includes(c); const sel = selectedColor === c;
                        return (
                          <button key={c} onClick={() => { setSelectedColor(sel ? null : c); setSelectedSize(null); }} disabled={!avail}
                            className={`text-[10px] font-bold font-orbitron uppercase tracking-wider px-3 py-1.5 rounded border transition-all
                              ${sel   ? 'border-neonCyan text-neonCyan bg-neonCyan/10 shadow-[0_0_10px_rgba(0,229,255,0.2)]' : ''}
                              ${!sel && avail ? 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white' : ''}
                              ${!avail ? 'border-white/5 text-gray-700 cursor-not-allowed opacity-40' : ''}`}
                          >{c}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {sizes.length > 0 && (
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-orbitron mb-2 block">Size</span>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map(s => {
                        const avail = availableSizes.includes(s); const sel = selectedSize === s;
                        return (
                          <button key={s} onClick={() => setSelectedSize(sel ? null : s)} disabled={!avail}
                            className={`min-w-[3rem] px-2 py-2 text-[9px] font-bold font-orbitron uppercase rounded border transition-all leading-tight text-center
                              ${sel   ? 'border-neonPink text-neonPink bg-neonPink/10 shadow-[0_0_10px_rgba(255,0,229,0.2)]' : ''}
                              ${!sel && avail ? 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white' : ''}
                              ${!avail ? 'border-white/5 text-gray-700 cursor-not-allowed opacity-40' : ''}`}
                          >{s}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-600 font-bold font-orbitron uppercase tracking-wider">{variants.length} variant{variants.length !== 1 ? 's' : ''} available</p>
                  {selectedVariant && <span className="text-[9px] font-bold font-orbitron uppercase tracking-widest text-neonCyan border border-neonCyan/30 bg-neonCyan/5 px-2 py-1 rounded">{selectedVariant.color} / {selectedVariant.size}</span>}
                </div>
              </>
            )}

            <div className="flex flex-col gap-2 mt-1">
              {orderStatus === 'success' && (
                <div className="border border-green-500/40 bg-green-500/10 rounded p-4 text-center">
                  <div className="text-green-400 font-orbitron font-bold text-xs uppercase tracking-wider mb-1">✓ Payment Confirmed</div>
                  <p className="text-[10px] text-green-300 font-bold font-orbitron tracking-wider">{orderMsg}</p>
                </div>
              )}
              {orderStatus === 'error' && (
                <div className="border border-neonPink/40 bg-neonPink/5 rounded p-3 text-center">
                  <p className="text-[10px] text-neonPink font-bold font-orbitron uppercase tracking-wider">{orderMsg}</p>
                </div>
              )}
              {orderStatus === 'processing' && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 size={14} className="animate-spin text-neonCyan" />
                  <span className="text-[10px] font-bold font-orbitron uppercase tracking-wider text-neonCyan">{orderMsg}</span>
                </div>
              )}
              {orderStatus !== 'success' && (
                !selectedVariant
                  ? <div className="w-full py-3 rounded border border-white/10 text-gray-600 font-orbitron font-bold text-xs uppercase tracking-widest text-center cursor-not-allowed">{(colors.length > 0 || sizes.length > 0) ? 'Select color & size above' : loading ? 'Loading...' : 'No options'}</div>
                  : !PAYPAL_CLIENT_ID
                    ? <div className="w-full py-3 rounded border border-neonOrange/30 text-neonOrange font-orbitron font-bold text-[10px] uppercase tracking-widest text-center">Add VITE_PAYPAL_CLIENT_ID to GitHub Secrets</div>
                    : <div ref={paypalContainerRef} className="w-full min-h-[50px]" />
              )}
              <button onClick={onClose} className="w-full flex items-center justify-center gap-2 font-orbitron font-bold text-[10px] uppercase tracking-widest py-2 rounded border border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300 transition-all">
                <X size={11} /> Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}

function MerchandiseStorefront() {
  const [products, setProducts]           = useState<PrintfulProduct[]>([]);
  const [loading, setLoading]             = useState(true);
  const [apiFail, setApiFail]             = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${PRINTFUL_HUB}?action=products`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setProducts(json?.result || []);
      } catch { setApiFail(true); }
      finally  { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onTouchEnd   = (e: TouchEvent) => {
      const dx    = startX - e.changedTouches[0].clientX;
      const cardW = ((el.firstElementChild as HTMLElement)?.offsetWidth || 256) + 20;
      if (Math.abs(dx) < cardW * 0.25) el.scrollTo({ left: Math.round(el.scrollLeft / cardW) * cardW, behavior: 'smooth' });
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchend', onTouchEnd); };
  }, [products]);

  return (
    <>
      <section className="py-8 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-4 mb-5">
          <span className="font-orbitron text-xs text-neonCyan font-extrabold tracking-widest">01</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase mr-3">Vice City <span className="text-neonCyan">Merch</span></h2>
          <span className="border border-neonCyan/40 bg-neonCyan/5 text-neonCyan text-[9px] font-bold tracking-[0.25em] px-3 py-1.5 rounded font-orbitron uppercase animate-pulse">Print-on-Demand · Ships Worldwide</span>
          <span className="border border-neonPink/30 bg-neonPink/5 text-neonPink text-[9px] font-bold tracking-widest px-3 py-1.5 rounded font-orbitron uppercase">Powered by Printful</span>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto flex items-center gap-1.5"><ShoppingBag size={11} className="text-neonCyan" /> Official Merchandise Storefront</span>
        </div>

        {loading && <div className="flex gap-5 overflow-x-auto pb-4 custom-scrollbar">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>}

        {!loading && apiFail && (
          <div className="glass-card p-8 flex flex-col items-center gap-4 text-center border-neonPink/20" style={{ minHeight: 220 }}>
            <AlertTriangle size={32} className="text-neonPink opacity-60" />
            <div>
              <h4 className="font-orbitron font-bold text-sm uppercase tracking-wider text-white mb-1">Store Temporarily Offline</h4>
              <p className="text-[11px] text-gray-500 font-bold font-rajdhani uppercase tracking-wider max-w-sm">Corrupt cop bribed the server. <a href="https://vice-city-hub.printful.me" target="_blank" rel="noopener noreferrer" className="text-neonCyan hover:underline">Visit store directly →</a></p>
            </div>
          </div>
        )}

        {!loading && !apiFail && products.length === 0 && (
          <div className="glass-card p-8 flex flex-col items-center gap-4 text-center border-neonOrange/20" style={{ minHeight: 220 }}>
            <Package size={32} className="text-neonOrange opacity-50" />
            <h4 className="font-orbitron font-bold text-sm uppercase tracking-wider text-white">Merch Drop Coming Soon™</h4>
          </div>
        )}

        {!loading && !apiFail && products.length > 0 && (
          <div ref={scrollRef} className="flex gap-5 overflow-x-auto pb-5 pt-2 custom-scrollbar" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
            {products.map(product => (
              <article key={product.id} onClick={() => setSelectedProduct(product)} className="flex-shrink-0 w-64 glass-card p-0 overflow-hidden cursor-pointer group" style={{ scrollSnapAlign: 'center' }}>
                <div className="w-full h-52 bg-[#0a0a14] flex items-center justify-center overflow-hidden relative">
                  <img src={product.thumbnail_url} alt={product.name} className="max-h-44 max-w-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-xl" loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x200/0c0c1c/444?text=MERCH'; }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
                    <span className="font-orbitron text-[9px] font-bold uppercase tracking-widest text-neonCyan">View Options ↗</span>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <h3 className="font-orbitron font-bold text-[11px] text-white uppercase tracking-wide leading-snug line-clamp-2 group-hover:text-neonCyan transition-colors">{product.name}</h3>
                  {product.variants != null && <span className="text-[9px] text-gray-500 font-bold font-orbitron uppercase tracking-widest flex items-center gap-1"><Tag size={9} className="text-neonOrange" />{product.variants} variant{product.variants !== 1 ? 's' : ''}</span>}
                  <button onClick={e => { e.stopPropagation(); setSelectedProduct(product); }} className="mt-1 w-full py-2 rounded border border-neonCyan/40 text-neonCyan text-[9px] font-bold font-orbitron uppercase tracking-widest hover:bg-neonCyan/10 hover:border-neonCyan transition-all">View Options</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !apiFail && products.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/5 p-5 rounded bg-[#050508]/60">
            <div className="flex items-start gap-3"><Shield className="text-neonCyan shrink-0 mt-0.5" size={16} /><div><h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-orbitron">Secure Checkout</h4><p className="text-[10px] text-gray-500 font-bold leading-normal mt-0.5">Payments via PayPal encrypted gateway.</p></div></div>
            <div className="flex items-start gap-3"><Zap className="text-neonOrange shrink-0 mt-0.5" size={16} /><div><h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-orbitron">Print-on-Demand</h4><p className="text-[10px] text-gray-500 font-bold leading-normal mt-0.5">Made fresh per order. No warehouse. Maximum drip.</p></div></div>
            <div className="flex items-start gap-3"><Globe className="text-neonPink shrink-0 mt-0.5" size={16} /><div><h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-orbitron">Ships Worldwide</h4><p className="text-[10px] text-gray-500 font-bold leading-normal mt-0.5">Delivered to Vice City and every zip code on the planet.</p></div></div>
          </div>
        )}
      </section>
      {selectedProduct && <MerchModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </>
  );
}

export default function Market() {
  const getTldColor = (title: string) => {
    const colors = ['#ff2070', '#00e5ff', '#ff7b35', '#a855f7', '#00d68f'];
    if (!title) return colors[0];
    const tld = title.includes('.') ? title.split('.').pop()?.toLowerCase() || '' : title.toLowerCase();
    if (tld === 'nft') return '#ff2070'; if (tld === 'eth') return '#a855f7';
    if (tld === 'crypto') return '#ff7b35'; if (tld === 'sol') return '#00d68f';
    let hash = 0; for (let i = 0; i < tld.length; i++) hash = tld.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const [dbDomains, setDbDomains]     = useState<DomainItem[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('All');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supa.from('posts').select('*').eq('type', 'domain').order('created_at', { ascending: false });
        if (error) throw error;
        setDbDomains(data || []);
      } catch (err) { console.error(err); }
    })();
    const timer = setTimeout(() => {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js'; script.async = true;
      script.onload = () => {
        try {
          // @ts-ignore
          new window.TradingView.widget({ autosize: true, symbol: 'NASDAQ:TTWO', interval: 'D', theme: 'dark', style: '1', locale: 'en', toolbar_bg: '#0c0c1c', container_id: 'tv-container', backgroundColor: '#07070f', gridColor: 'rgba(255,255,255,0.03)', allow_symbol_change: true });
        } catch (e) { console.error(e); }
      };
      document.body.appendChild(script);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const seenTitles = new Set<string>();
  const allDomains = dbDomains.filter(item => {
    const key = item.title.trim().toLowerCase();
    if (seenTitles.has(key)) return false; seenTitles.add(key); return true;
  });

  const availableTags = React.useMemo(() => {
    const tags = new Set<string>(['All']);
    allDomains.forEach(item => { if (item.meta) { try { const p = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta; if (p.tag) tags.add(p.tag.toLowerCase()); } catch {} } });
    return Array.from(tags);
  }, [allDomains]);

  useEffect(() => { if (!availableTags.map(t => t.toLowerCase()).includes(selectedTag.toLowerCase())) setSelectedTag('All'); }, [availableTags, selectedTag]);

  const filteredDomains = allDomains.filter(item => {
    let tag = 'eth';
    if (item.meta) { try { const p = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta; if (p.tag) tag = p.tag; } catch {} }
    return selectedTag === 'All' || tag.toLowerCase() === selectedTag.toLowerCase();
  });

  return (
    <div className="w-full">
      <header className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden bg-radial-hero py-16">
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(255,0,229,0.07)_0%,transparent_60%)]" />
        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonOrange uppercase border border-neonOrange/40 px-6 py-2.5 rounded-full bg-neonOrange/5 shadow-[0_0_15px_rgba(255,165,0,0.15)] mb-6 animate-pulse">MERCH · WEB3 ASSETS · INVESTOR RADAR</div>
          <h1 className="font-orbitron font-black text-5xl sm:text-7xl uppercase tracking-tighter bg-gradient-to-br from-white via-neonOrange to-neonCyan bg-clip-text text-transparent filter drop-shadow-2xl">THE MARKET</h1>
          <p className="text-xs sm:text-sm text-gray-400 font-bold max-w-lg mx-auto mt-4 leading-relaxed font-rajdhani uppercase tracking-widest">Official merch, Web3 domains, and live NASDAQ:TTWO intelligence. Everything you need to hustle in Vice City.</p>
        </div>
      </header>

      <div className="gradient-line" />
      <MerchandiseStorefront />
      <div className="gradient-line" />

      <section className="py-20 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-10">
          <span className="font-orbitron text-xs text-neonOrange font-extrabold tracking-widest">02</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">Web3 <span className="text-neonOrange">Domains</span></h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">Decentralized assets registry</span>
        </div>
        <div className="glass-card p-5 border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2"><Filter size={14} className="text-neonOrange" /> Filter TLD:</div>
          <div className="flex flex-wrap gap-2 font-orbitron text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            {availableTags.map(tag => (
              <button key={tag} onClick={() => setSelectedTag(tag)} className={`px-4 py-2 rounded border transition-all ${selectedTag.toLowerCase() === tag.toLowerCase() ? 'border-neonOrange text-neonOrange bg-neonOrange/10' : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-white'}`}>
                {tag === 'All' ? 'All' : `.${tag.toLowerCase()}`}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-4 pt-2 pb-2">
          {filteredDomains.map(item => {
            let price = 'TBD';
            if (item.meta) { try { const m = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta; if (m.price) price = !isNaN(parseFloat(m.price)) && parseFloat(m.price) > 0 ? '$' + new Intl.NumberFormat('en-US').format(parseFloat(m.price)) : m.price; } catch {} }
            const col = getTldColor(item.title);
            return (
              <article key={item.id} onClick={() => window.open(`https://ud.me/${item.title}`, '_blank')} className="flex-shrink-0 bg-[#161630]/90 hover:bg-[#1c1c38]/95 border-y border-r border-white/5 border-l-4 rounded transition-all duration-300 flex items-center justify-between p-5 md:p-6 cursor-pointer hover:-translate-y-0.5" style={{ borderLeftColor: col }}>
                <div>
                  <span className="font-orbitron font-extrabold text-base sm:text-lg tracking-wide uppercase" style={{ color: col }}>{item.title}</span>
                  <p className="text-xs text-gray-400 mt-1 font-bold font-rajdhani max-w-xl">{item.body}</p>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-orbitron mt-2">Seller: <span className="text-neonCyan">{item.author_name}</span></div>
                </div>
                <div className="text-right flex flex-col items-end gap-2 shrink-0">
                  <div className="font-orbitron font-extrabold text-xl sm:text-2xl" style={{ color: col }}>{price}</div>
                  <span className="border text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded font-orbitron pointer-events-none" style={{ borderColor: col, color: col }}>Buy ↗</span>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 border border-white/5 p-6 rounded bg-[#050508]/60">
          <div className="flex items-start gap-3"><Shield className="text-neonOrange shrink-0" size={18} /><div><h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-orbitron">Escrow Protected</h4><p className="text-[10px] text-gray-500 font-bold leading-normal mt-1">Settled via secure multisig smart contracts.</p></div></div>
          <div className="flex items-start gap-3"><Zap className="text-neonCyan shrink-0" size={18} /><div><h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-orbitron">Decentralized TLDs</h4><p className="text-[10px] text-gray-500 font-bold leading-normal mt-1">Compatible with decentralized browsers and IPFS.</p></div></div>
          <div className="flex items-start gap-3"><AlertTriangle className="text-neonPink shrink-0" size={18} /><div><h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-orbitron">List Your Domain</h4><p className="text-[10px] text-gray-500 font-bold leading-normal mt-1">Have a .eth or .sol? List it in your Dashboard.</p></div></div>
        </div>
      </section>

      <div className="gradient-line" />

      <section className="py-20 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-10">
          <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">03</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">Investor <span className="text-neonCyan">Telemetry</span></h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">Take-two corporate intelligence</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          <div className="glass-card p-8 border-white/5 flex flex-col justify-between">
            <div>
              <span className="border border-neonPink text-neonPink text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase rounded font-orbitron bg-neonPink/5">NASDAQ: TTWO</span>
              <h3 className="font-orbitron font-bold text-2xl text-white tracking-wide leading-snug mt-5 mb-4">Grand Theft Auto VI Financial Leverage</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-bold font-rajdhani">GTA VI represents the single largest entertainment release in human history, directly impacting Take-Two Interactive market cap.</p>
              <div className="mt-6 flex flex-col gap-3 font-orbitron text-[10px] uppercase font-bold tracking-wider">
                <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-gray-500">Corporate Owner</span><span className="text-white">Take-Two Interactive</span></div>
                <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-gray-500">Speculative Dev Cost</span><span className="text-neonOrange">$1.5B+ USD</span></div>
                <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-gray-500">Fiscal Revenue Target</span><span className="text-neonCyan">$8.0B+ FY27</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Beta Rating Index</span><span className="text-green-400">High Volatility</span></div>
              </div>
            </div>
            <div className="mt-8 border-t border-white/5 pt-5">
              <div className="flex items-start gap-2.5 text-xs text-neonPink font-bold uppercase tracking-wider font-orbitron mb-2"><AlertTriangle size={16} className="shrink-0" /> Speculator Disclaimer</div>
              <p className="text-[10px] text-gray-500 font-bold font-rajdhani leading-relaxed uppercase">For fan research only. Not certified financial advice.</p>
            </div>
          </div>
          <div className="lg:col-span-2 glass-card p-6 border-white/5 hover:border-neonCyan transition-all flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <span className="font-orbitron font-extrabold text-xs text-white tracking-widest uppercase flex items-center gap-2"><TrendingUp size={16} className="text-neonCyan" /> Live TTWO Stock Telemetry</span>
              <a href="https://www.tradingview.com/chart/?symbol=NASDAQ:TTWO" target="_blank" rel="noopener noreferrer" className="border border-white/10 hover:border-neonCyan text-[10px] uppercase font-bold font-orbitron tracking-widest px-3.5 py-1.5 rounded transition-all flex items-center gap-1.5">Open TradingView <ExternalLink size={10} /></a>
            </div>
            <div className="flex-grow w-full bg-[#050508]/90 rounded-lg relative overflow-hidden flex items-center justify-center border border-white/5">
              <div id="tv-container" className="absolute inset-0 w-full h-full" />
              <div className="pointer-events-none flex flex-col items-center gap-3">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,229,255,0.15)" strokeWidth="1.5" className="animate-pulse"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                <span className="font-orbitron font-bold text-[10px] tracking-widest text-gray-600 uppercase">Loading Live Stock Telemetry...</span>
              </div>
            </div>
            <div className="mt-4 text-[9px] text-gray-600 uppercase font-bold tracking-widest text-right font-orbitron">Powered by TradingView • Real-Time NASDAQ Hours</div>
          </div>
        </div>
      </section>
    </div>
  );
}
