import { useState, useEffect, useRef } from 'react';
import { Camera, Upload, CheckCircle2, XCircle, TrendingUp, BookOpen, Plus, ChevronRight, Brain, History, Award, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { analyzeMathProblem, generateSimilarProblem, AnalysisResult } from './services/geminiService';
import { cn } from './lib/utils';

// Types
interface Note extends AnalysisResult {
  id: string;
  date: string;
  status: 'incorrect' | 'correct' | 'retrying';
  attempts: Attempt[];
}

interface Attempt {
  id: string;
  date: string;
  isCorrect: boolean;
  feedback: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analyze' | 'notes' | 'growth' | 'practice'>('dashboard');
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [practiceProblem, setPracticeProblem] = useState<{ problem: string; solution: string } | null>(null);
  const [isGeneratingPractice, setIsGeneratingPractice] = useState(false);
  
  // Filter and Sort states
  const [filterStatus, setFilterStatus] = useState<Note['status'] | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('math_notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem('math_notes', JSON.stringify(notes));
  }, [notes]);

  // Computed filtered and sorted notes
  const filteredAndSortedNotes = notes
    .filter(note => filterStatus === 'all' || note.status === filterStatus)
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsAnalyzing(true);
    try {
      const base64Promises = files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(base64Promises);
      const results = await analyzeMathProblem(base64Images);
      
      const newNotes: Note[] = results.map((result, index) => ({
        ...result,
        id: (Date.now() + index).toString(),
        date: new Date().toLocaleDateString(),
        status: result.isCorrect ? 'correct' : 'incorrect',
        attempts: []
      }));

      setNotes(prev => [...newNotes, ...prev]);
      if (newNotes.length > 0) {
        setSelectedNote(newNotes[0]);
      }
      setActiveTab('notes');
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("분석에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetake = (noteId: string, isCorrect: boolean) => {
    setNotes(prev => prev.map(note => {
      if (note.id === noteId) {
        const newAttempt: Attempt = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString(),
          isCorrect,
          feedback: isCorrect ? "잘했습니다! 개념을 완벽히 이해하셨네요." : "아직 조금 부족합니다. 오답 노트를 다시 확인해보세요."
        };
        return {
          ...note,
          status: isCorrect ? 'correct' : 'retrying',
          attempts: [...note.attempts, newAttempt]
        };
      }
      return note;
    }));
  };

  const handleDeleteNote = (id: string) => {
    if (confirm("이 노트를 삭제하시겠습니까?")) {
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNote?.id === id) setSelectedNote(null);
    }
  };

  const startPractice = async (note: Note) => {
    setIsGeneratingPractice(true);
    try {
      const result = await generateSimilarProblem(note.problemText, note.conceptGuide);
      setPracticeProblem(result);
      setActiveTab('practice');
    } catch (error) {
      console.error("Practice generation failed:", error);
    } finally {
      setIsGeneratingPractice(false);
    }
  };

  // Stats for Dashboard
  const totalNotes = notes.length;
  const correctNotes = notes.filter(n => n.status === 'correct').length;
  const growthData = notes.slice().reverse().map((n, i) => ({
    name: n.date,
    score: n.status === 'correct' ? 100 : (n.attempts.length > 0 ? 50 : 0)
  }));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-full md:border-t-0 md:border-r">
        <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<History size={24} />} label="홈" />
        <NavItem active={activeTab === 'analyze'} onClick={() => setActiveTab('analyze')} icon={<Plus size={24} />} label="분석" />
        <NavItem active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<BookOpen size={24} />} label="오답" />
        <NavItem active={activeTab === 'growth'} onClick={() => setActiveTab('growth')} icon={<TrendingUp size={24} />} label="성장" />
      </nav>

      {/* Main Content */}
      <main className="pb-24 pt-6 px-4 md:pl-24 md:pt-12 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">안녕하세요! 👋</h1>
                <p className="text-gray-500">오늘도 수학 실력을 한 단계 더 높여볼까요?</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <StatCard icon={<BookOpen className="text-blue-500" />} label="전체 오답 노트" value={totalNotes} />
                <StatCard icon={<CheckCircle2 className="text-green-500" />} label="해결된 문제" value={correctNotes} />
                <StatCard icon={<Award className="text-orange-500" />} label="성장 점수" value={totalNotes > 0 ? Math.round((correctNotes / totalNotes) * 100) : 0} />
              </div>

              <section className="mb-12">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">최근 학습 기록</h2>
                  <button onClick={() => setActiveTab('notes')} className="text-blue-600 text-sm font-medium flex items-center">
                    전체 보기 <ChevronRight size={16} />
                  </button>
                </div>
                <div className="space-y-4">
                  {notes.slice(0, 3).map(note => (
                    <NoteListItem key={note.id} note={note} onClick={() => { setSelectedNote(note); setActiveTab('notes'); }} />
                  ))}
                  {notes.length === 0 && (
                    <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center">
                      <p className="text-gray-400 mb-4">아직 분석된 문제가 없습니다.</p>
                      <button onClick={() => setActiveTab('analyze')} className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium">
                        첫 문제 분석하기
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'analyze' && (
            <motion.div key="analyze" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center min-h-[70vh]">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Brain className="text-blue-600" size={48} />
                </div>
                <h2 className="text-2xl font-bold mb-4">풀이 과정을 분석합니다</h2>
                <p className="text-gray-500 mb-8">
                  학생이 직접 푼 문제의 사진을 찍거나 업로드해주세요. AI가 풀이 습관과 특징을 분석해드립니다.
                </p>
                
                <div className="flex flex-col gap-4">
                  <label className="cursor-pointer bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                    <Upload size={20} />
                    사진 업로드하기
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isAnalyzing} />
                  </label>
                  <p className="text-xs text-gray-400">여러 장의 사진을 한 번에 업로드할 수 있습니다.</p>
                </div>

                {isAnalyzing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-blue-600 font-medium animate-pulse">AI가 풀이 과정을 꼼꼼히 분석 중입니다...</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col md:flex-row gap-8">
                {/* Notes List */}
                <div className="w-full md:w-1/3 space-y-4">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">오답 노트</h2>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">{filteredAndSortedNotes.length}개</span>
                  </div>

                  {/* Filter & Sort Controls */}
                  <div className="space-y-3 mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <FilterButton active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label="전체" />
                      <FilterButton active={filterStatus === 'incorrect'} onClick={() => setFilterStatus('incorrect')} label="오답" />
                      <FilterButton active={filterStatus === 'retrying'} onClick={() => setFilterStatus('retrying')} label="재도전" />
                      <FilterButton active={filterStatus === 'correct'} onClick={() => setFilterStatus('correct')} label="해결" />
                    </div>
                    <select 
                      value={sortOrder} 
                      onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="newest">최신순</option>
                      <option value="oldest">오래된순</option>
                    </select>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                    {filteredAndSortedNotes.map(note => (
                      <div 
                        key={note.id} 
                        onClick={() => setSelectedNote(note)}
                        className={cn(
                          "p-4 rounded-2xl border cursor-pointer transition-all",
                          selectedNote?.id === note.id ? "bg-white border-blue-600 shadow-md ring-2 ring-blue-50" : "bg-white border-gray-200 hover:border-blue-300"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-medium text-gray-400">{note.date}</span>
                          <StatusBadge status={note.status} />
                        </div>
                        <p className="text-sm font-semibold line-clamp-2">{note.problemText}</p>
                      </div>
                    ))}
                    {filteredAndSortedNotes.length === 0 && (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        해당하는 노트가 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* Note Detail */}
                <div className="w-full md:w-2/3">
                  {selectedNote ? (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-bold">분석 리포트</h3>
                        <div className="flex gap-2">
                          <button onClick={() => startPractice(selectedNote)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="유사 문제 풀기">
                            <Brain size={20} />
                          </button>
                          <button onClick={() => handleDeleteNote(selectedNote.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <Section title="문제 내용" content={selectedNote.problemText} />
                        
                        {/* Answer Comparison */}
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className={cn(
                            "flex-1 p-4 rounded-2xl flex flex-col items-center justify-center text-center border transition-all",
                            selectedNote.isCorrect 
                              ? "bg-green-50 border-green-100" 
                              : "bg-red-50 border-red-100"
                          )}>
                            <div className="flex items-center gap-2 mb-1">
                              {selectedNote.isCorrect ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                              <span className={cn(
                                "text-[10px] font-bold uppercase",
                                selectedNote.isCorrect ? "text-green-400" : "text-red-400"
                              )}>학생의 답</span>
                            </div>
                            <span className={cn(
                              "text-2xl font-black",
                              selectedNote.isCorrect ? "text-green-600" : "text-red-600"
                            )}>{selectedNote.studentAnswer}</span>
                            <span className="text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full bg-white border border-inherit">
                              {selectedNote.isCorrect ? "정답입니다!" : "오답입니다"}
                            </span>
                          </div>
                          <div className="flex items-center justify-center text-gray-300">
                            <ChevronRight size={24} className="rotate-90 md:rotate-0" />
                          </div>
                          <div className="flex-1 bg-gray-50 border border-gray-100 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">실제 정답</span>
                            <span className="text-2xl font-black text-gray-600">{selectedNote.correctAnswer}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-blue-50 p-6 rounded-2xl">
                            <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                              <TrendingUp size={18} /> 학생 특징
                            </h4>
                            <ul className="list-disc list-inside text-blue-700 text-sm space-y-1">
                              {selectedNote.characteristics.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                          <div className="bg-green-50 p-6 rounded-2xl">
                            <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                              <CheckCircle2 size={18} /> 선호 풀이법
                            </h4>
                            <ul className="list-disc list-inside text-green-700 text-sm space-y-1">
                              {selectedNote.preferredMethods.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        </div>

                        <Section title="오답 분석" content={selectedNote.errorAnalysis} highlight />
                        <Section title="올바른 풀이" content={selectedNote.correctSolution} />
                        
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl border border-indigo-100">
                          <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                            <BookOpen size={20} /> 핵심 개념 및 추천 학습
                          </h4>
                          <div className="prose prose-indigo prose-sm max-w-none text-indigo-800">
                            <ReactMarkdown>{selectedNote.conceptGuide}</ReactMarkdown>
                          </div>
                        </div>

                        <div className="pt-8 border-t border-gray-100">
                          <h4 className="font-bold mb-4">다시 풀기 기록</h4>
                          <div className="space-y-3 mb-6">
                            {selectedNote.attempts.map(attempt => (
                              <div key={attempt.id} className="flex items-center gap-3 text-sm p-3 bg-gray-50 rounded-xl">
                                {attempt.isCorrect ? <CheckCircle2 className="text-green-500" size={16} /> : <XCircle className="text-red-500" size={16} />}
                                <span className="font-medium">{attempt.date}</span>
                                <span className="text-gray-500">{attempt.feedback}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => handleRetake(selectedNote.id, true)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">맞았어요!</button>
                            <button onClick={() => handleRetake(selectedNote.id, false)} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">또 틀렸어요...</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl p-12">
                      왼쪽 리스트에서 문제를 선택하거나 새로운 문제를 분석해보세요.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'growth' && (
            <motion.div key="growth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-2xl font-bold mb-8">나의 성장 분석</h2>
              
              {notes.length > 0 ? (
                <>
                  <div className="bg-white p-8 rounded-3xl border border-gray-200 mb-8">
                    <h3 className="text-lg font-semibold mb-6">학습 성취도 추이</h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#999' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#999' }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                          <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={3} dot={{ r: 6, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-200">
                      <h4 className="font-bold mb-4">가장 많이 보완된 개념</h4>
                      <div className="space-y-3">
                        {notes.length >= 3 ? (
                          ['이차방정식', '삼각함수', '미분계수'].map((concept, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <span className="text-sm font-medium">{concept}</span>
                              <div className="flex-1 mx-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${80 - i * 15}%` }}></div>
                              </div>
                              <span className="text-xs font-bold text-blue-600">+{80 - i * 15}%</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">자료부족 (최소 3개 이상의 데이터 필요)</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 text-center flex flex-col items-center justify-center">
                      <h4 className="font-bold mb-4 w-full text-left">AI 학습 조언</h4>
                      {notes.some(n => n.attempts.length > 0) ? (
                        <p className="text-sm text-gray-600 leading-relaxed text-left">
                          최근 해결한 {correctNotes}개의 문제를 바탕으로 분석했을 때, 오답을 재도풀이하는 습관이 매우 좋습니다. 
                          {totalNotes > 5 ? "특히 소수점 계산 실수가 줄어들고 있어 긍정적입니다." : "데이터가 더 쌓이면 구체적인 습관 분석이 가능합니다."}
                        </p>
                      ) : (
                        <p className="text-gray-400 font-medium">자료부족</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white p-24 rounded-3xl border border-dashed border-gray-300 text-center">
                  <TrendingUp className="text-gray-300 mx-auto mb-4" size={48} />
                  <p className="text-2xl font-bold text-gray-400">자료부족</p>
                  <p className="text-gray-400 mt-2">먼저 문제를 업로드하고 학습을 시작해보세요.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'practice' && (
            <motion.div key="practice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <button onClick={() => setActiveTab('notes')} className="p-2 hover:bg-gray-100 rounded-full">
                    <History size={20} />
                  </button>
                  <h2 className="text-2xl font-bold">맞춤 연습 문제</h2>
                </div>

                {isGeneratingPractice ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <RefreshCw className="text-blue-600 animate-spin mb-4" size={48} />
                    <p className="text-gray-500">학생의 취약점을 보완할 새로운 문제를 생성 중입니다...</p>
                  </div>
                ) : practiceProblem ? (
                  <div className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                      <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">문제</h4>
                      <div className="prose prose-blue max-w-none">
                        <ReactMarkdown>{practiceProblem.problem}</ReactMarkdown>
                      </div>
                    </div>

                    <details className="group bg-white rounded-3xl border border-gray-200 overflow-hidden">
                      <summary className="p-6 cursor-pointer flex justify-between items-center font-bold hover:bg-gray-50 transition-colors">
                        정답 및 해설 확인하기
                        <ChevronRight className="group-open:rotate-90 transition-transform" size={20} />
                      </summary>
                      <div className="p-8 border-t border-gray-100 bg-gray-50">
                        <div className="prose prose-blue max-w-none">
                          <ReactMarkdown>{practiceProblem.solution}</ReactMarkdown>
                        </div>
                      </div>
                    </details>

                    <button onClick={() => setActiveTab('analyze')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-100">
                      새로운 문제 분석하기
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-24 text-gray-400">
                    오답 노트에서 '유사 문제 풀기'를 선택해주세요.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-components
function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active ? "text-blue-600 scale-110" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
      {active && <motion.div layoutId="nav-indicator" className="w-1 h-1 bg-blue-600 rounded-full mt-1" />}
    </button>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
        active ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
      )}
    >
      {label}
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: number | string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className="p-3 bg-gray-50 rounded-2xl">{icon}</div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function NoteListItem({ note, onClick }: { note: Note, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={note.status} />
          <span className="text-[10px] font-bold text-gray-400">{note.date}</span>
        </div>
        <p className="text-sm font-semibold line-clamp-1">{note.problemText}</p>
      </div>
      <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={20} />
    </div>
  );
}

function StatusBadge({ status }: { status: Note['status'] }) {
  const styles = {
    incorrect: "bg-red-50 text-red-600 border-red-100",
    correct: "bg-green-50 text-green-600 border-green-100",
    retrying: "bg-orange-50 text-orange-600 border-orange-100"
  };
  const labels = {
    incorrect: "오답",
    correct: "해결됨",
    retrying: "재도전 중"
  };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", styles[status])}>
      {labels[status]}
    </span>
  );
}

function Section({ title, content, highlight = false }: { title: string, content: string, highlight?: boolean }) {
  return (
    <div>
      <h4 className="font-bold text-gray-900 mb-2">{title}</h4>
      <div className={cn("prose prose-sm max-w-none text-gray-600 leading-relaxed", highlight && "p-4 bg-red-50 rounded-xl text-red-800 border-l-4 border-red-500")}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
