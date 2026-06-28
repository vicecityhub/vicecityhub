import React, { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lpglkglhjdqnktybksth.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk'
);

// ── TYPES ──────────────────────────────────────────────────────────────────
interface StorePlan {
  id: string;
  name: string;
  price_usd: number;
  badge_label?: string;
  badge_color?: string;
  features: string[];
  slot_count: number;
  is_featured: boolean;
}

interface StoreProduct {
  id: string;
  title: string;
  description: string;
  preview_url?: string;
  price_label: string;
  tags: string[];
  frameworks: string[];
  buy_url: string;
  is_featured?: boolean;
}

interface StoreTenant {
  id: string;
  name: string;
  tagline: string;
  logo_url?: string;
  banner_url?: string;
  website_url: string;
  discord_url?: string;
  category: string;
  verified: boolean;
  is_featured: boolean;
  views: number;
  products: StoreProduct[];
  plan_name?: string;
}

// ── STATIC DATA (until Supabase populated) ────────────────────────────────
const PLANS: StorePlan[] = [
  {
    id: 'starter', name: 'STARTER', price_usd: 19,
    features: ['1 store card in directory', 'Logo + link + tagline', 'Category tag', 'Monthly stats report'],
    slot_count: 1, is_featured: false,
  },
  {
    id: 'featured', name: 'FEATURED', price_usd: 49, badge_label: 'BEST VALUE', badge_color: 'pink',
    features: ['Up to 4 product cards', 'FEATURED badge', 'Top placement in category', 'Click & visit analytics', 'Discord link + banner', 'Priority in search'],
    slot_count: 4, is_featured: true,
  },
  {
    id: 'premium', name: 'PREMIUM', price_usd: 99, badge_label: 'MAX EXPOSURE', badge_color: 'yellow',
    features: ['Up to 12 product cards', 'VERIFIED store badge', 'Homepage banner slot (rotating)', 'Pinned in Store District header', 'Full analytics dashboard', 'VCH Discord shoutout', 'Custom accent color'],
    slot_count: 12, is_featured: false,
  },
];

const CAT_COLORS: Record<string, string> = {
  SCRIPTS: '#00FFFF', MODS: '#FF00FF', ASSETS: '#FFE135',
  BUNDLES: '#FF6B35', TOOLS: '#b44fff', MAPS: '#44ff88', SERVICES: '#ff9900',
};

const DEMO_TENANTS: StoreTenant[] = [
  {
    id: 't1', name: 'Quasar Store', tagline: 'Premium FiveM Scripts for ESX, QB & Qbox',
    logo_url: 'https://www.quasar-store.com/quasar-y-t.png',
    website_url: 'https://www.quasar-store.com',
    discord_url: 'https://discord.com/invite/quasarstore',
    category: 'SCRIPTS', verified: true, is_featured: true, views: 12847, plan_name: 'PREMIUM',
    products: [
      { id: 'p1', title: 'Smartphone 3.0', description: '50+ apps, Dynamic Island, Aura AI. The most advanced FiveM phone ever built.', price_label: 'FROM $34', tags: ['Phone', 'UI', 'Social'], frameworks: ['ESX','QB','Qbox'], buy_url: 'https://www.quasar-store.com/product/smartphone', is_featured: true },
      { id: 'p2', title: 'Housing Creator', description: 'Next-gen housing with decoration tools, RGB lighting, stashes and premium shells.', price_label: '$89', tags: ['Housing', 'MLO', 'Decor'], frameworks: ['ESX','QB','Qbox'], buy_url: 'https://www.quasar-store.com/product/housing-creator' },
      { id: 'p3', title: 'Police Creator', description: 'Complete LEO system: CAD, MDT, dispatch, K9, CCTV and real-time unit tracking.', price_label: '$59', tags: ['Police', 'CAD', 'MDT'], frameworks: ['ESX','QB','Qbox'], buy_url: 'https://www.quasar-store.com/product/police-creator' },
      { id: 'p4', title: 'Advanced Inventory', description: 'AAA-level inventory UI with drop system, trunks, gloveboxes and mission rewards.', price_label: '$29', tags: ['Inventory', 'UI'], frameworks: ['ESX','QB','Qbox'], buy_url: 'https://www.quasar-store.com/product/advanced-inventory' },
    ],
  },
  {
    id: 't2', name: 'Your Store Here', tagline: 'Premium FiveM assets, scripts & MLOs',
    website_url: '#', category: 'SCRIPTS', verified: false, is_featured: false, views: 0, plan_name: 'FEATURED',
    products: [],
  },
  {
    id: 't3', name: 'Your Store Here', tagline: 'Maps, interiors & custom vehicles for RP',
    website_url: '#', category: 'MAPS', verified: false, is_featured: false, views: 0, plan_name: 'STARTER',
    products: [],
  },
];

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function PlanCard({ plan, onRent }: { plan: StorePlan; onRent: (plan: StorePlan) => void }) {
  const borderColor = plan.badge_color === 'pink'
    ? 'border-neonPink/60 shadow-[0_0_20px_rgba(255,0,255,0.15)]'
    : plan.badge_color === 'yellow'
    ? 'border-neonYellow/50'
    : 'border-white/10';

  return (
    <div className={`glass-card-static rounded-xl p-6 flex flex-col relative border ${borderColor} transition-all duration-300 hover:transform hover:-translate-y-1`}>
      {plan.badge_label && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded text-[9px] font-black tracking-widest font-orbitron whitespace-nowrap
          ${plan.badge_color === 'pink' ? 'bg-neonPink text-black' : plan.badge_color === 'yellow' ? 'bg-neonYellow text-black' : 'bg-white/10 text-white'}`}>
          {plan.badge_label}
        </div>
      )}

      <div className="text-center mb-4 pt-2">
        <div className="font-orbitron font-black text-xs tracking-[0.3em] text-white/40 mb-1">{plan.name}</div>
        <div className="flex items-end justify-center gap-1">
          <span className={`font-orbitron font-black text-3xl ${plan.badge_color === 'pink' ? 'text-neonPink' : plan.badge_color === 'yellow' ? 'text-neonYellow' : 'text-neonCyan'}`} style={{ textShadow: plan.is_featured ? '0 0 15px rgba(255,0,255,0.6)' : undefined }}>
            ${plan.price_usd}
          </span>
          <span className="text-white/30 text-xs mb-1 font-bold">/mo</span>
        </div>
        <div className="text-[10px] text-white/35 mt-1">up to {plan.slot_count} product card{plan.slot_count > 1 ? 's' : ''}</div>
      </div>

      <div className="space-y-2 mb-6 flex-1">
        {plan.features.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-white/60">
            <span className={plan.badge_color === 'pink' ? 'text-neonPink' : plan.badge_color === 'yellow' ? 'text-neonYellow' : 'text-neonCyan'}>✓</span>
            {f}
          </div>
        ))}
      </div>

      <button
        onClick={() => onRent(plan)}
        className={`btn-neon btn-neon-sm w-full justify-center
          ${plan.badge_color === 'yellow' ? 'btn-neon-orange' : plan.badge_color === 'pink' ? '' : 'btn-neon-cyan'}`}
      >
        CLAIM SLOT
      </button>
    </div>
  );
}

function ProductCard({ product }: { product: StoreProduct }) {
  return (
    <div className="glass-card-static rounded-lg p-3 border border-white/[0.06] hover:border-neonPink/30 transition-all duration-200 hover:transform hover:-translate-y-0.5 flex flex-col">
      {product.is_featured && (
        <div className="text-[8px] font-black tracking-widest text-neonPink border border-neonPink/40 bg-neonPink/10 rounded px-1.5 py-0.5 w-fit mb-2">★ FEATURED</div>
      )}
      <div className="font-bold text-xs text-white mb-1 leading-tight">{product.title}</div>
      <p className="text-[10px] text-white/45 leading-relaxed mb-2 flex-1 line-clamp-2">{product.description}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {product.frameworks.map(f => (
          <span key={f} className="text-[8px] px-1.5 py-0.5 rounded bg-neonCyan/10 border border-neonCyan/25 text-neonCyan/70 font-bold">{f}</span>
        ))}
        {product.tags.slice(0, 2).map(t => (
          <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/35">{t}</span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/5">
        <span className="font-orbitron font-black text-xs text-neonPink">{product.price_label}</span>
        <a href={product.buy_url} target="_blank" rel="noreferrer"
           className="btn-neon btn-neon-sm text-[8px] px-2 py-1">BUY</a>
      </div>
    </div>
  );
}

function TenantCard({ tenant, onClick }: { tenant: StoreTenant; onClick: () => void }) {
  const catColor = CAT_COLORS[tenant.category] || '#fff';
  const isEmpty = tenant.products.length === 0;

  if (isEmpty) {
    // Пустой слот — реклама аренды
    return (
      <div
        onClick={onClick}
        className="rounded-xl border-2 border-dashed border-white/10 hover:border-neonPink/40 transition-all duration-300 cursor-pointer p-6 flex flex-col items-center justify-center text-center min-h-[200px] group"
        style={{ background: 'rgba(255,0,255,0.02)' }}
      >
        <div className="text-3xl mb-3 opacity-30 group-hover:opacity-60 transition-opacity">🏪</div>
        <div className="font-orbitron font-black text-xs tracking-widest text-white/25 group-hover:text-neonPink/60 transition-colors mb-1">
          SLOT AVAILABLE
        </div>
        <div className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors">
          {tenant.plan_name} plan · Click to rent
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card-static rounded-xl overflow-hidden border transition-all duration-300
      ${tenant.is_featured ? 'border-neonPink/40 shadow-[0_0_25px_rgba(255,0,255,0.1)]' : 'border-white/[0.07] hover:border-neonPink/25'}`}>

      {/* Store Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="w-9 h-9 rounded-lg object-contain bg-white/5 p-1" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-neonPink/10 border border-neonPink/20 flex items-center justify-center text-lg">🏪</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-orbitron font-black text-xs text-white truncate">{tenant.name}</span>
            {tenant.verified && <span className="text-[8px] bg-neonCyan/15 border border-neonCyan/35 text-neonCyan px-1.5 py-0.5 rounded font-black tracking-wider flex-shrink-0">✓ VERIFIED</span>}
            {tenant.is_featured && <span className="text-[8px] bg-neonPink/15 border border-neonPink/35 text-neonPink px-1.5 py-0.5 rounded font-black tracking-wider flex-shrink-0">★ FEATURED</span>}
          </div>
          <p className="text-[10px] text-white/40 truncate">{tenant.tagline}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded" style={{ color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}30` }}>
            {tenant.category}
          </div>
          {tenant.views > 0 && <div className="text-[8px] text-white/20 mt-1">{tenant.views.toLocaleString()} views</div>}
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-3">
        {tenant.products.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {tenant.products.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex gap-2">
        <a href={tenant.website_url} target="_blank" rel="noreferrer" className="btn-neon btn-neon-sm flex-1 justify-center text-[9px]">
          VISIT STORE
        </a>
        {tenant.discord_url && (
          <a href={tenant.discord_url} target="_blank" rel="noreferrer" className="btn-neon btn-neon-cyan btn-neon-sm px-3 text-[9px]">
            DISCORD
          </a>
        )}
      </div>
    </div>
  );
}

// ── LEASE REQUEST FORM ─────────────────────────────────────────────────────
function LeaseForm({ selectedPlan, onClose, formRef }: { selectedPlan: StorePlan | null; onClose: () => void; formRef?: React.RefObject<HTMLDivElement> }) {
  const [form, setForm] = useState({ store_name: '', contact_email: '', website_url: '', discord_url: '', category: 'SCRIPTS', message: '', plan_id: selectedPlan?.id || 'featured' });
  const [submitted, setSubmitted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const submit = async () => {
    if (!form.store_name || !form.contact_email) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Получаем реальный UUID плана по его name
      const planName = form.plan_id.toUpperCase(); // 'starter' -> 'STARTER'
      const { data: planRows } = await supabase
        .from('store_plans')
        .select('id, name, price_usd')
        .ilike('name', planName)
        .limit(1);
      const resolvedPlanId = planRows?.[0]?.id ?? null;

      const { error } = await supabase
        .from('store_lease_requests')
        .insert({
          store_name:    form.store_name,
          contact_email: form.contact_email,
          website_url:   form.website_url || null,
          discord_url:   form.discord_url || null,
          category:      form.category,
          plan_id:       resolvedPlanId,
          message:       form.message     || null,
          status:        'PENDING',
        });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError('Connection error. Please try again or reach out via email.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">✅</div>
        <div className="font-orbitron font-black text-sm text-neonCyan mb-2 tracking-widest">APPLICATION RECEIVED</div>
        <p className="text-white/50 text-sm mb-6">We'll get back to you within 48 hours. Welcome to the District.</p>
        <button onClick={onClose} className="btn-neon btn-neon-cyan btn-neon-sm">CLOSE</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">STORE NAME *</label>
          <input type="text" placeholder="Quasar Store" value={form.store_name} onChange={e => setForm(p => ({...p, store_name: e.target.value}))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50 transition-colors" />
        </div>
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">CONTACT EMAIL *</label>
          <input type="email" placeholder="you@yourstore.com" value={form.contact_email} onChange={e => setForm(p => ({...p, contact_email: e.target.value}))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50 transition-colors" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">STORE URL</label>
          <input type="url" placeholder="https://yourstore.com" value={form.website_url} onChange={e => setForm(p => ({...p, website_url: e.target.value}))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50 transition-colors" />
        </div>
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">DISCORD SERVER</label>
          <input type="url" placeholder="https://discord.gg/yourstore" value={form.discord_url} onChange={e => setForm(p => ({...p, discord_url: e.target.value}))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50 transition-colors" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">CATEGORY</label>
          <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-neonPink/50 transition-colors">
            {['SCRIPTS','MODS','ASSETS','BUNDLES','TOOLS','MAPS','SERVICES'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">PLAN</label>
          <select value={form.plan_id} onChange={e => setForm(p => ({...p, plan_id: e.target.value}))}
            className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-neonPink/50 transition-colors">
            {PLANS.map(pl => <option key={pl.id} value={pl.id}>{pl.name} — ${pl.price_usd}/mo</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[9px] text-white/35 font-bold tracking-widest block mb-1">ANYTHING ELSE?</label>
        <textarea placeholder="Tell us about your store, what you sell, special requests..." value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))} rows={3}
          className="w-full bg-black/40 border border-neonPink/20 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonPink/50 transition-colors resize-none" />
      </div>
      {submitError && (
        <p className="text-[10px] text-red-400 font-bold border border-red-400/30 bg-red-400/10 rounded px-3 py-2">
          ⚠ {submitError}
        </p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={submit}
          disabled={!form.store_name || !form.contact_email || submitting}
          className={`btn-neon flex-1 justify-center ${form.store_name && form.contact_email && !submitting ? '' : 'opacity-40 cursor-not-allowed'}`}
        >
          {submitting ? 'SENDING...' : 'SUBMIT APPLICATION'}
        </button>
        <button onClick={onClose} className="btn-neon btn-neon-cyan px-5">CANCEL</button>
      </div>
    </div>
  );
}

// ── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function StoreTab({ onFormOpen }: { onFormOpen?: (open: boolean) => void }) {
  const [showPricing, setShowPricing] = useState(false);
  const [showLeaseForm, setShowLeaseForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<StorePlan | null>(null);
  const plansRef = useRef<HTMLDivElement>(null);
  const formRef  = useRef<HTMLDivElement>(null);

  const scrollToPlans = () => {
    setShowPricing(true);
    setShowLeaseForm(false);
    setTimeout(() => {
      plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const handleRent = (plan: StorePlan) => {
    setSelectedPlan(plan);
    setShowLeaseForm(true);
    setShowPricing(false);
    onFormOpen?.(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus first input after scroll
      setTimeout(() => {
        const first = formRef.current?.querySelector<HTMLInputElement>('input,select,textarea');
        first?.focus({ preventScroll: true });
      }, 400);
    }, 80);
  };

  const handleFormClose = () => {
    setShowLeaseForm(false);
    onFormOpen?.(false);
  };

  const filtered = categoryFilter === 'ALL'
    ? DEMO_TENANTS
    : DEMO_TENANTS.filter(t => t.category === categoryFilter);

  return (
    <div className="slide-in">

      {/* ── HERO BANNER ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8" style={{
        background: 'linear-gradient(135deg, rgba(255,0,255,0.08) 0%, rgba(10,10,20,0.95) 40%, rgba(0,255,255,0.05) 100%)',
        border: '1px solid rgba(255,0,255,0.2)',
      }}>
        <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />
        <div className="relative px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-[9px] tracking-[0.4em] text-white/30 font-orbitron mb-2">VICE CITY HUB — v11</div>
            <h2 className="font-orbitron font-black text-2xl md:text-3xl tracking-wider leading-tight mb-2">
              <span className="text-neonPink" style={{textShadow:'0 0 10px rgba(255,0,255,0.6),0 0 25px rgba(255,0,255,0.3)'}}>STORE</span>
              <span className="text-white mx-2">DISTRICT</span>
            </h2>
            <p className="text-white/45 text-sm max-w-lg leading-relaxed">
              The Vice City Hub marketplace. FiveM stores, script vendors and asset creators
              rent slots here to reach <span className="text-neonCyan font-bold">our audience directly</span>.
              Premium placement. Real traffic. No bullshit middlemen.
            </p>
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/30 font-bold">
              <span>📦 Scripts & Mods</span>
              <span>🗺️ MLOs & Maps</span>
              <span>🔧 Tools & Assets</span>
              <span>📦 Bundles</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0">
            <button onClick={scrollToPlans}
              className="btn-neon pulse-glow text-center">
              🏪 RENT A SLOT
            </button>
            <div className="text-[9px] text-white/25 text-center">From $19/month</div>
          </div>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { val: '12,800+', label: 'Monthly Visitors', color: 'text-neonPink' },
          { val: '3 slots', label: 'Currently Available', color: 'text-neonCyan' },
          { val: '$19/mo', label: 'Starting Price', color: 'text-neonYellow' },
        ].map(s => (
          <div key={s.label} className="glass-card-static rounded-xl p-4 text-center border border-white/[0.06]">
            <div className={`font-orbitron font-black text-lg ${s.color}`} style={{ textShadow: s.color.includes('Pink') ? '0 0 10px rgba(255,0,255,0.4)' : undefined }}>
              {s.val}
            </div>
            <div className="text-[9px] text-white/30 tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── PRICING SECTION ── */}
      {showPricing && (
        <div ref={plansRef} className="mb-8 slide-in" style={{ scrollMarginTop: "80px" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-orbitron font-black text-sm tracking-widest text-neonCyan">◈ CHOOSE YOUR SLOT PLAN</h3>
              <p className="text-[10px] text-white/35 mt-0.5">Monthly billing. Cancel anytime. No refund on used months.</p>
            </div>
            <button onClick={() => setShowPricing(false)} className="text-white/30 hover:text-white font-bold text-lg transition-colors">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} onRent={handleRent} />)}
          </div>
        </div>
      )}

      {/* ── LEASE FORM ── */}
      {showLeaseForm && (
        <div ref={formRef} className="mb-8 slide-in glass-card-static rounded-xl p-6 border border-neonPink/20" style={{ scrollMarginTop: '12px' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-orbitron font-black text-sm tracking-widest text-neonPink">◈ SLOT APPLICATION</h3>
              {selectedPlan && <p className="text-[10px] text-white/35 mt-0.5">Plan: {selectedPlan.name} · ${selectedPlan.price_usd}/mo</p>}
            </div>
          </div>
          <LeaseForm selectedPlan={selectedPlan} onClose={handleFormClose} formRef={formRef} />
        </div>
      )}

      {/* ── DIRECTORY ── */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-orbitron font-black text-sm tracking-widest text-white">◈ ACTIVE STORES</h3>
          <p className="text-[10px] text-white/30 mt-0.5">Verified vendors and script creators advertising on Vice City Hub</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...Object.keys(CAT_COLORS)].map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`text-[9px] px-3 py-1 rounded font-orbitron font-black tracking-wider border transition-all
                ${categoryFilter === cat
                  ? 'border-neonPink/60 bg-neonPink/15 text-neonPink'
                  : 'border-white/10 text-white/30 hover:border-white/25'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {filtered.map(t => (
          <TenantCard
            key={t.id}
            tenant={t}
            onClick={() => { setShowPricing(true); setShowLeaseForm(false); }}
          />
        ))}
      </div>

      {/* ── WHY ADVERTISE HERE ── */}
      <div className="glass-card-static rounded-xl p-6 border border-white/[0.06]">
        <h3 className="font-orbitron font-black text-xs tracking-widest text-neonCyan mb-4">◈ WHY ADVERTISE ON VICE CITY HUB</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '🎯', title: 'Targeted Audience', desc: 'FiveM server owners and RP players. Not random traffic — people who buy scripts.' },
            { icon: '📊', title: 'Real Analytics', desc: 'Track views, clicks, and conversions in real time via your dashboard.' },
            { icon: '⚡', title: 'Instant Activation', desc: 'Your store goes live within 24h of payment confirmation.' },
            { icon: '🤝', title: 'No Revenue Cut', desc: 'We rent the slot. Your sales, your money. We don\'t touch your transactions.' },
          ].map(item => (
            <div key={item.title} className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-bold text-xs text-white mb-1">{item.title}</div>
              <p className="text-[10px] text-white/35 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-white/[0.05] text-center">
          <p className="text-[10px] text-white/25 mb-3">Ready to put your store in front of 12,000+ monthly visitors?</p>
          <button onClick={scrollToPlans}
            className="btn-neon btn-neon-sm">GET YOUR SLOT NOW</button>
        </div>
      </div>

    </div>
  );
}

