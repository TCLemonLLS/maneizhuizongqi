import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  Trash2, 
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Tag,
  FileText,
  ChevronRight,
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  Download,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { Transaction, Stats } from './types';

const CATEGORIES = {
  expense: ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他'],
  income: ['工资', '奖金', '投资', '兼职', '礼金', '其他']
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({ total_income: 0, total_expense: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // AI Advice state
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '餐饮',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/stats')
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      setTransactions(tData);
      setStats(sData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateAIAdvice = async () => {
    if (transactions.length === 0) {
      alert('请先添加一些记录，以便 AI 为您提供建议。');
      return;
    }

    setIsGeneratingAdvice(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const balance = (stats.total_income || 0) - (stats.total_expense || 0);
      
      const categorySummary = Object.entries(
        transactions
          .filter(t => t.type === 'expense')
          .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
          }, {} as Record<string, number>)
      ).map(([name, value]) => `${name}: ¥${value}`).join(', ');

      const recentT = transactions.slice(0, 5).map(t => `${t.date} ${t.type === 'income' ? '收入' : '支出'} ¥${t.amount} (${t.category}${t.description ? ': ' + t.description : ''})`).join('\n');

      const prompt = `你是一个专业的理财顾问。根据以下用户的财务数据，提供3-5条具体的、可操作的存钱建议。
当前余额: ¥${balance}
总收入: ¥${stats.total_income}
总支出: ¥${stats.total_expense}
支出分类: ${categorySummary}
最近记录:
${recentT}

请用亲切、鼓励的语气回答，并使用 Markdown 格式。建议要针对用户的具体支出情况。`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAdvice(response.text || "暂时无法生成建议，请稍后再试。");
    } catch (error) {
      console.error('AI Advice Error:', error);
      alert('生成 AI 建议时出错。');
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || isNaN(Number(formData.amount))) return;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount)
        })
      });

      if (res.ok) {
        setIsAdding(false);
        setFormData({
          amount: '',
          type: 'expense',
          category: '餐饮',
          description: '',
          date: format(new Date(), 'yyyy-MM-dd')
        });
        fetchData();
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    
    if (deleteConfirmText !== deletingTransaction.category) {
      alert('输入信息不匹配，无法删除');
      return;
    }

    try {
      const res = await fetch(`/api/transactions/${deletingTransaction.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeletingTransaction(null);
        setDeleteConfirmText('');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const balance = (stats.total_income || 0) - (stats.total_expense || 0);

  // Chart Data
  const categoryData: { name: string; value: number }[] = Object.entries(
    transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value: value as number }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#71717a'];

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-zinc-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
              <Wallet size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">马内追踪器</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowInstallGuide(true)}
              className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"
              title="手机安装指南"
            >
              <Smartphone size={20} />
            </button>
            <button 
              onClick={generateAIAdvice}
              disabled={isGeneratingAdvice}
              className="p-2 text-emerald-600 bg-emerald-50 rounded-full hover:bg-emerald-100 transition-colors disabled:opacity-50"
              title="获取 AI 存钱建议"
            >
              {isGeneratingAdvice ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-zinc-900 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-colors"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">记一笔</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* AI Advice Section */}
        <AnimatePresence>
          {aiAdvice && (
            <motion.section 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-50 border border-emerald-100 rounded-3xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Sparkles size={20} />
                    <h3 className="font-bold">AI 存钱助手建议</h3>
                  </div>
                  <button 
                    onClick={() => setAiAdvice(null)}
                    className="text-emerald-400 hover:text-emerald-600 transition-colors"
                  >
                    隐藏
                  </button>
                </div>
                <div className="prose prose-sm prose-emerald max-w-none text-emerald-800 markdown-body">
                  <Markdown>{aiAdvice}</Markdown>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Balance Card */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col justify-between"
          >
            <span className="text-zinc-500 text-sm font-medium">当前余额</span>
            <div className="mt-2">
              <span className="text-3xl font-bold">¥{balance.toLocaleString()}</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:contents gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col sm:flex-row items-center gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <TrendingUp size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="text-center sm:text-left">
                <span className="text-zinc-500 text-[10px] sm:text-sm font-medium">总收入</span>
                <p className="text-sm sm:text-xl font-bold text-emerald-600">+¥{stats.total_income?.toLocaleString() || 0}</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-zinc-100 flex flex-col sm:flex-row items-center gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
                <TrendingDown size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="text-center sm:text-left">
                <span className="text-zinc-500 text-[10px] sm:text-sm font-medium">总支出</span>
                <p className="text-sm sm:text-xl font-bold text-rose-600">-¥{stats.total_expense?.toLocaleString() || 0}</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Charts & Insights */}
        {categoryData.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <PieChartIcon size={18} className="text-zinc-400" />
                支出构成
              </h3>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Filter size={18} className="text-zinc-400" />
                分类详情
              </h3>
              <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2">
                {[...categoryData].sort((a, b) => b.value - a.value).map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-sm font-medium text-zinc-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold">¥{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Transaction List */}
        <section className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-bold text-lg">最近记录</h3>
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
              {transactions.length} 条记录
            </span>
          </div>
          
          <div className="divide-y divide-zinc-50">
            <AnimatePresence mode="popLayout">
              {transactions.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-zinc-300">
                    <FileText size={32} />
                  </div>
                  <p className="text-zinc-400 font-medium">还没有任何记录，开始记一笔吧！</p>
                </div>
              ) : (
                (() => {
                  const grouped = transactions.reduce((groups, t) => {
                    const date = t.date;
                    if (!groups[date]) groups[date] = [];
                    groups[date].push(t);
                    return groups;
                  }, {} as Record<string, Transaction[]>);

                  return Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => (
                    <div key={date} className="bg-white">
                      <div className="px-6 py-2 bg-zinc-50/50 border-y border-zinc-100/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {format(parseISO(date), 'yyyy年MM月dd日')}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">
                          当日支出: ¥{grouped[date].filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-50">
                        {grouped[date].map((t) => (
                          <motion.div 
                            key={t.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center",
                                t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                              )}>
                                {t.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-900">{t.category}</span>
                                  {t.description && (
                                    <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                                      {t.description}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-400 font-medium">
                                  {t.type === 'income' ? '收入' : '支出'} • {t.category}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "font-bold text-lg",
                                t.type === 'income' ? "text-emerald-600" : "text-zinc-900"
                              )}>
                                {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                              </span>
                              <button 
                                onClick={() => {
                                  setDeletingTransaction(t);
                                  setDeleteConfirmText('');
                                }}
                                className="p-2 text-zinc-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ));
                })()
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">记一笔</h2>
                  <div className="flex bg-zinc-100 p-1 rounded-full">
                    <button 
                      onClick={() => {
                        setFormData(prev => ({ ...prev, type: 'expense', category: CATEGORIES.expense[0] }));
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                        formData.type === 'expense' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"
                      )}
                    >
                      支出
                    </button>
                    <button 
                      onClick={() => {
                        setFormData(prev => ({ ...prev, type: 'income', category: CATEGORIES.income[0] }));
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                        formData.type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-zinc-400"
                      )}
                    >
                      收入
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">金额</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-zinc-400">¥</span>
                      <input 
                        type="number"
                        step="0.01"
                        autoFocus
                        required
                        value={formData.amount}
                        onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-4 bg-zinc-50 border-none rounded-2xl text-3xl font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        <Tag size={12} /> 分类
                      </label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-3 bg-zinc-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                      >
                        {CATEGORIES[formData.type].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        <CalendarIcon size={12} /> 日期
                      </label>
                      <input 
                        type="date"
                        required
                        value={formData.date}
                        onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full p-3 bg-zinc-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                      <FileText size={12} /> 备注
                    </label>
                    <input 
                      type="text"
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="想说点什么..."
                      className="w-full p-4 bg-zinc-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 py-4 bg-zinc-100 text-zinc-500 rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20"
                    >
                      保存记录
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Install Guide Modal */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallGuide(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <Smartphone size={32} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold">手机端安装指南</h2>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    本程序是渐进式 Web 应用 (PWA)，无需下载 APK 即可获得原生应用体验。
                  </p>
                </div>
                
                <div className="text-left space-y-4 bg-zinc-50 p-4 rounded-2xl">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</div>
                    <p className="text-xs text-zinc-600">在手机浏览器（推荐 Chrome 或 Safari）中打开此页面。</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</div>
                    <p className="text-xs text-zinc-600">点击浏览器菜单中的 <span className="font-bold text-zinc-900">“添加到主屏幕”</span> 或 <span className="font-bold text-zinc-900">“安装应用”</span>。</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</div>
                    <p className="text-xs text-zinc-600">现在你可以像使用普通 App 一样从桌面启动它了！</p>
                  </div>
                </div>

                <button 
                  onClick={() => setShowInstallGuide(false)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors"
                >
                  我知道了
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingTransaction(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 size={32} />
                </div>
                <h2 className="text-xl font-bold">确认删除此记录？</h2>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  为了防止误删，请在下方输入该记录的分类名称 <span className="font-bold text-zinc-900">"{deletingTransaction.category}"</span> 以确认删除。
                </p>
                
                <div className="space-y-4 pt-2">
                  <input 
                    type="text"
                    autoFocus
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="在此输入分类名称"
                    className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-rose-500/20 focus:ring-0 rounded-2xl text-center font-bold transition-all"
                  />
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setDeletingTransaction(null)}
                      className="flex-1 py-3 bg-zinc-100 text-zinc-500 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={deleteConfirmText !== deletingTransaction.category}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold transition-all",
                        deleteConfirmText === deletingTransaction.category 
                          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                          : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                      )}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
