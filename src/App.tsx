import { useState, useEffect, ReactNode, FormEvent } from 'react';
import { 
  Plus, 
  Search, 
  Home, 
  Users, 
  History, 
  IndianRupee, 
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signIn, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ledgerService } from './services/ledgerService';
import { Customer, Transaction } from './types';
import { Keypad } from './components/Keypad';
import { cn } from './lib/utils';

// --- Components ---

function AuthScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f0]">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
            <IndianRupee className="text-white size-10" />
          </div>
        </div>
        <h1 className="text-4xl font-serif font-bold text-slate-800 mb-2">Namma Ledger</h1>
        <p className="text-slate-500 mb-12">Simplified Digital Khata for your daily Santhe.</p>
        <button
          onClick={signIn}
          className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="Google" className="size-5" />
          Login with Google
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, type }: { label: string, value: number, type: 'total' | 'daily' | 'dues' }) {
  const colors = {
    total: "bg-orange-50 text-orange-700",
    daily: "bg-emerald-50 text-emerald-700",
    dues: "bg-red-50 text-red-700"
  };

  return (
    <div className={cn("p-5 rounded-2xl shadow-sm border border-slate-100", colors[type])}>
      <span className="text-xs uppercase tracking-wider font-bold opacity-70">{label}</span>
      <div className="text-2xl font-bold mt-1 flex items-center">
        <IndianRupee className="size-5 mr-0.5" />
        {value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'customers' | 'history' | 'add' | 'add-customer'>('home');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  // Transaction flow state
  const [flowStep, setFlowStep] = useState<1 | 2>(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [transType, setTransType] = useState<'credit' | 'payment'>('credit');
  const [searchQuery, setSearchQuery] = useState("");

  // New customer form state
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchData = async () => {
    if (!user) return;
    const [custs, trans] = await Promise.all([
      ledgerService.getCustomers(),
      ledgerService.getRecentTransactions()
    ]);
    if (custs) setCustomers(custs);
    if (trans) setTransactions(trans);
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  if (loading) return null;
  if (!user) return <AuthScreen />;

  const totalOutstanding = customers.reduce((sum, c) => sum + c.totalDue, 0);
  
  const today = new Date().toDateString();
  const todaysTrans = transactions.filter(t => t.timestamp?.toDate().toDateString() === today);
  
  const dailySales = todaysTrans
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const dailyPayments = todaysTrans
    .filter(t => t.type === 'payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone?.includes(searchQuery)
  );

  const handleAddTransaction = async () => {
    if (!selectedCustomer || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      await ledgerService.addTransaction(
        selectedCustomer.id, 
        selectedCustomer.name, 
        numAmount, 
        transType
      );
      
      setMessage({ text: "Transaction recorded successfully!", type: 'success' });
      // Reset and refresh
      setAmount("");
      setSelectedCustomer(null);
      setFlowStep(1);
      setView('home');
      fetchData();
    } catch (error) {
      setMessage({ text: "Failed to record transaction.", type: 'error' });
    }
  };

  const handleAddCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCustName) return;
    
    setIsSubmitting(true);
    try {
      await ledgerService.addCustomer(newCustName, newCustPhone || undefined);
      setMessage({ text: "Customer added successfully!", type: 'success' });
      setNewCustName("");
      setNewCustPhone("");
      setView('customers');
      fetchData();
    } catch (error) {
      setMessage({ text: "Failed to add customer.", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsApp = (customer: Customer) => {
    if (!customer.phone) {
        alert("No phone number for this customer");
        return;
    }
    const message = `Namaste ${customer.name}, your total pending due at Namma Ledger is ₹${customer.totalDue}. Please pay at your convenience. Thank you!`;
    window.open(`https://wa.me/91${customer.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f0] text-slate-800 font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden">
      
      {/* Header */}
      <header className="px-6 pt-8 pb-4 bg-white shadow-sm flex justify-between items-center z-10">
        <div>
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center -rotate-6">
                <IndianRupee className="text-white size-4" />
             </div>
             <h1 className="text-xl font-serif font-bold">Namma Ledger</h1>
           </div>
           <p className="text-xs text-slate-400 font-medium mt-1">VILLAGE MARKET EDITION</p>
        </div>
        <button onClick={signOut} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
          <LogOut className="size-5" />
        </button>
      </header>

      {/* Toast Notification */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "absolute top-4 left-6 right-6 z-50 p-4 rounded-xl shadow-lg border text-center font-bold text-sm",
              message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
            )}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-6 py-4 pb-24">
        <AnimatePresence mode="wait">
          
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <StatCard label="Total Outstanding Dues" value={totalOutstanding} type="dues" />
                </div>
                <StatCard label="Today's Sales" value={dailySales} type="daily" />
                <StatCard label="Today's Payments" value={dailyPayments} type="total" />
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { setTransType('credit'); setView('add'); setFlowStep(1); }}
                    className="flex flex-col items-center justify-center p-4 bg-orange-600 text-white rounded-xl shadow-md hover:bg-orange-700 transition-colors gap-2"
                  >
                    <Plus className="size-6" />
                    <span className="font-bold text-sm">Add Udari</span>
                  </button>
                  <button 
                    onClick={() => { setTransType('payment'); setView('add'); setFlowStep(1); }}
                    className="flex flex-col items-center justify-center p-4 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-700 transition-colors gap-2"
                  >
                    <ArrowDownLeft className="size-6" />
                    <span className="font-bold text-sm">Got Payment</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-serif font-bold">Recent Ledger</h3>
                  <button onClick={() => setView('history')} className="text-sm font-bold text-orange-600">See All</button>
                </div>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          t.type === 'credit' ? "bg-orange-100" : "bg-emerald-100"
                        )}>
                          {t.type === 'credit' ? <ArrowUpRight className="text-orange-600 size-5" /> : <ArrowDownLeft className="text-emerald-600 size-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{t.customerName}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{t.timestamp?.toDate().toLocaleString()}</p>
                        </div>
                      </div>
                      <p className={cn(
                        "font-bold text-sm",
                        t.type === 'credit' ? "text-orange-600" : "text-emerald-600"
                      )}>
                        {t.type === 'credit' ? '+' : '-'} ₹{t.amount}
                      </p>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                        <History className="size-8" />
                      </div>
                      <p className="text-sm font-medium">No transactions yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'customers' && (
            <motion.div 
              key="customers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                <input 
                  type="text" 
                  placeholder="Search customer name..." 
                  className="w-full bg-white border border-slate-200 rounded-xl py-4 pl-12 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                 <button 
                  onClick={() => setView('add-customer')}
                  className="w-full bg-orange-50 text-orange-600 font-bold py-4 rounded-xl border border-dashed border-orange-200 flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors"
                >
                  <Plus className="size-5" />
                  Add New Customer
                </button>

                {filteredCustomers.map(c => (
                  <div key={c.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-serif font-bold text-lg">{c.name}</h4>
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
                            <Phone className="size-3" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Due</p>
                        <p className="text-xl font-bold text-red-600">₹{c.totalDue}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => { setSelectedCustomer(c); setTransType('credit'); setView('add'); setFlowStep(2); }}
                        className="flex-1 bg-slate-100 text-slate-800 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                      >
                        Add Udari
                      </button>
                      <button 
                        onClick={() => openWhatsApp(c)}
                        className="flex items-center justify-center bg-emerald-100 text-emerald-700 py-2.5 px-4 rounded-lg hover:bg-emerald-200 transition-colors"
                      >
                        <WhatsAppIcon className="size-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold">
                  {transType === 'credit' ? 'New Udari' : 'Record Payment'}
                </h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  STEP {flowStep} OF 2
                </span>
              </div>

              {flowStep === 1 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                    <input 
                      type="text" 
                      placeholder="Search customer..." 
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 shadow-sm focus:outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    {filteredCustomers.slice(0, 10).map(c => (
                      <button 
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setFlowStep(2); }}
                        className="w-full bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center text-left hover:border-orange-200 transition-all active:scale-[0.98]"
                      >
                        <div>
                          <p className="font-bold">{c.name}</p>
                          <p className="text-xs text-slate-400">Due: ₹{c.totalDue}</p>
                        </div>
                        <ChevronRight className="size-5 text-slate-300" />
                      </button>
                    ))}
                    <button 
                      onClick={() => setView('add-customer')}
                      className="w-full py-4 text-orange-600 font-bold text-sm"
                    >
                      + Add New Customer
                    </button>
                  </div>
                </div>
              )}

              {flowStep === 2 && selectedCustomer && (
                <div className="flex flex-col space-y-6">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</p>
                      <p className="text-lg font-serif font-bold">{selectedCustomer.name}</p>
                    </div>
                    <button onClick={() => setFlowStep(1)} className="text-sm font-bold text-orange-600">Change</button>
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Enter Amount</p>
                    <div className="flex items-center justify-center text-6xl font-bold mb-8">
                       <IndianRupee className="size-8 mr-1 text-slate-300" />
                       <span className={!amount ? "text-slate-200" : "text-slate-800"}>
                         {amount || "0"}
                       </span>
                    </div>

                    <Keypad 
                      onKeyPress={(k) => setAmount(prev => prev.length < 7 ? prev + k : prev)}
                      onClear={() => setAmount("")}
                      onBackspace={() => setAmount(prev => prev.slice(0, -1))}
                      className="max-w-xs mx-auto"
                    />

                    <button 
                      disabled={!amount}
                      onClick={handleAddTransaction}
                      className={cn(
                        "mt-6 mb-12 w-full py-5 rounded-2xl text-white font-bold text-lg shadow-xl transition-all",
                        transType === 'credit' ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700",
                        !amount && "opacity-50 grayscale cursor-not-allowed"
                      )}
                    >
                      Record {transType === 'credit' ? 'Udari' : 'Payment'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'add-customer' && (
            <motion.div
              key="add-customer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-serif font-bold">New Customer</h2>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Ramesh Kumar" 
                    className="w-full bg-white border border-slate-200 rounded-xl py-4 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phone Number (Optional)</label>
                  <input 
                    type="tel" 
                    placeholder="10 digit mobile number" 
                    className="w-full bg-white border border-slate-200 rounded-xl py-4 px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                  />
                </div>
                <div className="pt-4 space-y-3">
                  <button 
                    disabled={isSubmitting || !newCustName}
                    type="submit"
                    className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-orange-700 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : "Create Customer Account"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('customers')}
                    className="w-full text-slate-400 font-bold py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {view === 'history' && (
             <motion.div 
                key="history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <h2 className="text-2xl font-serif font-bold mb-6">Full Ledger</h2>
                <div className="space-y-3">
                   {transactions.map(t => (
                      <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            t.type === 'credit' ? "bg-orange-100" : "bg-emerald-100"
                          )}>
                             {t.type === 'credit' ? <ArrowUpRight className="text-orange-600 size-5" /> : <ArrowDownLeft className="text-emerald-600 size-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{t.customerName}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{t.timestamp?.toDate().toLocaleString()}</p>
                          </div>
                        </div>
                        <p className={cn(
                          "font-bold text-sm",
                          t.type === 'credit' ? "text-orange-600" : "text-emerald-600"
                        )}>
                          {t.type === 'credit' ? '+' : '-'} ₹{t.amount}
                        </p>
                      </div>
                   ))}
                </div>
              </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        <NavButton active={view === 'home'} icon={<Home />} label="Home" onClick={() => setView('home')} />
        <NavButton active={view === 'customers'} icon={<Users />} label="Passbook" onClick={() => setView('customers')} />
        <div className="relative -top-8">
            <button 
              onClick={() => { setView('add'); setFlowStep(1); }}
              className="w-14 h-14 bg-orange-600 text-white rounded-full flex items-center justify-center shadow-orange-600/40 shadow-xl active:scale-90 transition-all border-4 border-[#f5f5f0]"
            >
              <Plus className="size-8" />
            </button>
        </div>
        <NavButton active={view === 'history'} icon={<History />} label="Ledger" onClick={() => setView('history')} />
        <NavButton active={false} icon={<UserIcon />} label="Profile" onClick={() => {}} />
      </nav>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className={cn("transition-colors", active ? "text-orange-600" : "text-slate-400")}>
        {icon}
      </div>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", active ? "text-orange-600" : "text-slate-400")}>
        {label}
      </span>
    </button>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
