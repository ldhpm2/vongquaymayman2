import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { 
  Upload, Play, Save, Trash2, UserPlus, Trophy, Download, 
  Sparkles, Users, Settings, RotateCcw, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

interface Student {
  id: number;
  name: string;
  scores: (number | string)[];
}

const COLORS = [
  '#3b82f6', '#0ea5e9', '#f97316', '#ec4899', '#a855f7', '#7c3aed', '#4338ca'
];

const DEFAULT_STUDENTS: Student[] = [
  { id: 1, name: 'Nguyễn Văn An', scores: ['', '', '', '', ''] },
  { id: 2, name: 'Trần Thị Bình', scores: ['', '', '', '', ''] },
  { id: 3, name: 'Lê Hoàng Cường', scores: ['', '', '', '', ''] },
  { id: 4, name: 'Phạm Minh Đức', scores: ['', '', '', '', ''] },
  { id: 5, name: 'Hoàng Thu Thảo', scores: ['', '', '', '', ''] },
  { id: 6, name: 'Vũ Hải Nam', scores: ['', '', '', '', ''] },
];

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Student | null>(null);
  const [removeWinner, setRemoveWinner] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<Student[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelRef = useRef<{ rotation: number }>({ rotation: 0 });
  const audioTickRef = useRef<HTMLAudioElement | null>(null);
  const audioWinRef = useRef<HTMLAudioElement | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('lucky_wheel_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.students && parsed.students.length > 0) {
          setStudents(parsed.students);
        } else {
          setStudents(DEFAULT_STUDENTS);
        }
        if (parsed.showTable) setShowTable(parsed.showTable);
      } catch (e) {
        console.error('Failed to load saved data', e);
        setStudents(DEFAULT_STUDENTS);
      }
    } else {
      setStudents(DEFAULT_STUDENTS);
      setShowTable(true);
    }

    audioTickRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
    audioWinRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    audioTickRef.current.volume = 1.0;
    audioWinRef.current.volume = 1.0;
    
    // Preload sounds
    audioTickRef.current.load();
    audioWinRef.current.load();
  }, []);

  const saveToLocalStorage = () => {
    const data = {
      students,
      showTable
    };
    localStorage.setItem('lucky_wheel_data', JSON.stringify(data));
    setSaveMessage('Đã lưu điểm thành công!');
    setTimeout(() => setSaveMessage(''), 3000);
    
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.9, x: 0.8 }
    });
  };

  const downloadExcel = () => {
    if (students.length === 0) return;

    const header = ['STT', 'Họ và tên', 'KTTX 1', 'KTTX 2', 'KTTX 3', 'KTTX 4', 'KTTX 5'];
    const rows = students.map((s, i) => [
      i + 1,
      s.name,
      ...s.scores
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách điểm');
    
    // Auto-size columns
    const maxWidths = header.map((h, i) => {
      let max = h.length;
      rows.forEach(row => {
        const cellValue = String(row[i] || '');
        if (cellValue.length > max) max = cellValue.length;
      });
      return { wch: max + 2 };
    });
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, 'Danh_sach_diem_hoc_sinh.xlsx');
  };

  // Draw the wheel
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    ctx.clearRect(0, 0, size, size);

    const activeStudents = students;
    const sliceAngle = (2 * Math.PI) / (activeStudents.length || 1);

    activeStudents.forEach((student, i) => {
      const startAngle = i * sliceAngle + wheelRef.current.rotation;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Arial';
      
      // Truncate name if too long
      let displayName = student.name;
      if (displayName.length > 20) displayName = displayName.substring(0, 17) + '...';
      
      ctx.fillText(displayName, radius - 40, 10);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.stroke();

    // Draw pointer (triangle on the right pointing inwards)
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(size - 40, centerY); // Tip pointing to the center
    ctx.lineTo(size - 10, centerY - 25);
    ctx.lineTo(size - 10, centerY + 25);
    ctx.closePath();
    ctx.fillStyle = '#1e293b'; // Slate 800
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [students]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  const spin = () => {
    if (spinning || students.length === 0) return;

    setSpinning(true);
    setWinner(null);

    const spinDuration = 5000;
    const startRotation = wheelRef.current.rotation;
    const extraSpins = 5 + Math.random() * 5;
    const targetRotation = startRotation + extraSpins * 2 * Math.PI;
    const startTime = performance.now();
    let lastSliceIndex = -1;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      // Easing function: easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      const currentRotation = startRotation + (targetRotation - startRotation) * easeProgress;
      wheelRef.current.rotation = currentRotation;
      drawWheel();

      // Play tick sound when passing a slice
      if (students.length > 0) {
        const sliceAngle = (2 * Math.PI) / students.length;
        const currentSliceIndex = Math.floor((currentRotation % (2 * Math.PI)) / sliceAngle);
        
        if (currentSliceIndex !== lastSliceIndex) {
          if (audioTickRef.current) {
            audioTickRef.current.currentTime = 0;
            audioTickRef.current.play().catch(() => {}); // Ignore errors if browser blocks autoplay
          }
          lastSliceIndex = currentSliceIndex;
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        
        // Calculate winner
        const totalRotation = wheelRef.current.rotation % (2 * Math.PI);
        const sliceAngle = (2 * Math.PI) / students.length;
        
        // The pointer is at 0 radians (right side)
        let normalizedRotation = (2 * Math.PI - totalRotation) % (2 * Math.PI);
        if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;
        
        const winnerIndex = Math.floor(normalizedRotation / sliceAngle) % students.length;
        const selectedWinner = students[winnerIndex];
        setWinner(selectedWinner);
        setHistory(prev => [selectedWinner, ...prev].slice(0, 10)); // Keep last 10 winners
        
        // Play win sound
        if (audioWinRef.current) {
          audioWinRef.current.currentTime = 0;
          audioWinRef.current.play().catch(() => {});
        }

        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });

        if (removeWinner) {
          setTimeout(() => {
            setStudents(prev => prev.filter(s => s.id !== selectedWinner.id));
          }, 2000);
        }
      }
    };

    requestAnimationFrame(animate);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (data.length === 0) return;

      // Find the header row and name column index
      let nameColIndex = 0;
      let startRowIndex = 1;
      
      const nameKeywords = ['họ và tên', 'họ tên', 'tên', 'name', 'full name'];
      
      // Look through the first 10 rows to find headers
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        if (!row) continue;
        
        const foundIndex = row.findIndex(cell => 
          typeof cell === 'string' && nameKeywords.some(kw => cell.toLowerCase().includes(kw))
        );
        
        if (foundIndex !== -1) {
          nameColIndex = foundIndex;
          startRowIndex = i + 1;
          break;
        }
      }

      // If we didn't find a header, try to guess: 
      // Often column 0 is STT, column 1 is Name
      if (startRowIndex === 1 && nameColIndex === 0 && data[0]) {
        const firstRow = data[0];
        // If first cell is a number or "STT", name is likely in second cell
        if (typeof firstRow[0] === 'number' || (typeof firstRow[0] === 'string' && firstRow[0].toLowerCase() === 'stt')) {
          nameColIndex = 1;
        }
      }

      const newStudents: Student[] = data.slice(startRowIndex)
        .map((row, index) => {
          const name = String(row[nameColIndex] || '').trim();
          if (!name) return null;
          
          // Scores are usually the columns following the name
          const scores = [];
          for (let i = 1; i <= 5; i++) {
            scores.push(row[nameColIndex + i] || '');
          }
          
          return {
            id: index + 1,
            name: name,
            scores: scores
          };
        })
        .filter((s): s is Student => s !== null);

      if (newStudents.length > 0) {
        setStudents(newStudents);
        setShowTable(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const updateScore = (studentId: number, scoreIndex: number, value: string) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId 
        ? { ...s, scores: s.scores.map((score, i) => i === scoreIndex ? value : score) }
        : s
    ));
  };

  const generateWithAI = async () => {
    if (generating) return;
    setGenerating(true);
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Generate a list of 10 sample Vietnamese student names for a lucky wheel app. Return ONLY a JSON array of strings.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const names = JSON.parse(response.text || "[]");
      if (Array.isArray(names)) {
        const newStudents: Student[] = names.map((name, i) => ({
          id: Date.now() + i,
          name: name,
          scores: ['', '', '', '', '']
        }));
        setStudents(prev => [...prev, ...newStudents]);
        setShowTable(true);
        
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("AI Generation failed. Please check your API key.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 flex flex-col">
      {/* Top Banner */}
      <div className="bg-[#1e40af] text-white py-2 px-4 text-center">
        <p className="text-xs font-bold tracking-widest uppercase">
          PHÁT TRIỂN BỞI THẦY LƯƠNG ĐÌNH HÙNG ZALO 0986 282 414 © 2026
        </p>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-[#6366f1] p-2.5 rounded-lg shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-neutral-800 uppercase">
                VÒNG QUAY MAY MẮN
              </h1>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                QUẢN LÝ ĐIỂM KTTX
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={spin}
              disabled={spinning || students.length === 0}
              className="flex items-center space-x-2 bg-[#6366f1] text-white px-8 py-2.5 rounded-full shadow-lg hover:bg-[#4f46e5] disabled:opacity-50 transition-all font-black text-sm uppercase tracking-widest group"
            >
              <Play className={`w-4 h-4 fill-current transition-transform ${spinning ? 'scale-0' : 'group-hover:scale-110'}`} />
              <span>{spinning ? 'ĐANG QUAY...' : 'QUAY NGAY!'}</span>
            </button>

            <label className="flex items-center space-x-2 bg-white border border-neutral-200 px-4 py-2.5 rounded-full shadow-sm hover:bg-neutral-50 transition-all cursor-pointer group">
              <div className={`w-4 h-4 border border-neutral-300 rounded flex items-center justify-center transition-colors ${removeWinner ? 'bg-indigo-600 border-indigo-600' : 'bg-white'}`}>
                {removeWinner && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
              </div>
              <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-tight whitespace-nowrap">LOẠI BỎ NGƯỜI THẮNG</span>
              <input type="checkbox" checked={removeWinner} onChange={(e) => setRemoveWinner(e.target.checked)} className="hidden" />
            </label>

            <label className="flex items-center space-x-2 bg-white border border-neutral-200 px-5 py-2.5 rounded-full shadow-sm hover:bg-neutral-50 cursor-pointer transition-all font-bold text-[10px] uppercase tracking-wider text-neutral-600 group">
              <Upload className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600 transition-all" />
              <span className="flex items-center">↑ NHẬP EXCEL</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>

            <button 
              onClick={saveToLocalStorage}
              className="flex items-center space-x-2 bg-white border border-neutral-200 px-5 py-2.5 rounded-full shadow-sm hover:bg-neutral-50 transition-all font-bold text-[10px] uppercase tracking-wider text-neutral-600 relative group"
            >
              <Save className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600 transition-all" />
              <span>LƯU TRÌNH DUYỆT</span>
              <AnimatePresence>
                {saveMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -40 }}
                    exit={{ opacity: 0 }}
                    className="absolute whitespace-nowrap bg-emerald-500 text-white text-[10px] py-1 px-2 rounded-lg shadow-lg left-1/2 -translate-x-1/2 flex items-center"
                  >
                    {saveMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            <button 
              onClick={downloadExcel}
              disabled={students.length === 0}
              className="flex items-center space-x-2 bg-white border border-neutral-200 px-5 py-2.5 rounded-full shadow-sm hover:bg-neutral-50 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider text-neutral-600 group"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600 transition-all" />
              <span className="flex items-center">↓ XUẤT EXCEL</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Wheel (Sticky on Desktop) */}
        <div className="lg:col-span-6 xl:col-span-6">
          <div className="lg:sticky lg:top-28 space-y-3">
            <div className="relative bg-white p-4 md:p-6 rounded-3xl shadow-xl border border-neutral-200 flex justify-center">
              <canvas 
                ref={canvasRef} 
                width={780} 
                height={780} 
                className="w-full max-w-[730px] h-auto cursor-pointer"
                onClick={spin}
              />
              
              <AnimatePresence>
                {winner && !spinning && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none p-4"
                  >
                    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border-4 border-yellow-400 text-center max-w-full relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-pulse" />
                      <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 drop-shadow-lg animate-bounce" />
                      <h2 className="text-2xl font-black text-neutral-800 mb-2 uppercase tracking-tighter flex items-center justify-center">
                        <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                        CHÚC MỪNG!
                        <Sparkles className="w-5 h-5 ml-2 text-yellow-500" />
                      </h2>
                      <div className="bg-indigo-50 px-6 py-4 rounded-2xl border border-indigo-100">
                        <p className="text-3xl font-black text-indigo-600 break-words leading-tight">{winner.name}</p>
                      </div>
                      <p className="mt-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Bạn là người may mắn nhất!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Winner History Section */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-neutral-800 uppercase tracking-widest flex items-center">
                  <History className="w-4 h-4 mr-2 text-indigo-500" />
                  Lịch sử trúng thưởng
                </h3>
                {history.length > 0 && (
                  <button 
                    onClick={() => setHistory([])}
                    className="text-[10px] font-bold text-neutral-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    XÓA LỊCH SỬ
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                {history.length > 0 ? (
                  history.map((h, i) => (
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      key={i} 
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100 group hover:border-indigo-200 transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                          {history.length - i}
                        </div>
                        <span className="text-sm font-bold text-neutral-700 group-hover:text-indigo-600 transition-colors">{h.name}</span>
                      </div>
                      <Trophy className="w-4 h-4 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))
                ) : (
                  <div className="py-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
                    <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest italic">CHƯA CÓ LỊCH SỬ</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Table */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-black text-neutral-800 uppercase tracking-widest flex items-center">
              DANH SÁCH HỌC SINH & ĐIỂM SỐ
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">ĐANG HOẠT ĐỘNG</span>
            </div>
          </div>

          {showTable && (
            <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden flex-1 flex flex-col min-h-[600px]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-50/30 border-b border-neutral-100">
                    <tr>
                      <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-r border-neutral-100 w-12 text-center">#</th>
                      <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-r border-neutral-100" style={{ width: '6cm', minWidth: '6cm' }}>
                        HỌ VÀ TÊN
                      </th>
                      {[1, 2, 3, 4, 5].map(i => (
                        <th key={i} className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-r border-neutral-100 text-center w-14">
                          TX{i}
                        </th>
                      ))}
                      <th className="p-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-center w-12">
                        <Settings className="w-3 h-3 mx-auto" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {students.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="p-4 text-xs font-bold text-neutral-400 border-r border-neutral-100 text-center group-hover:text-indigo-400 transition-colors">{idx + 1}</td>
                        <td className="p-4 text-sm font-bold text-neutral-800 border-r border-neutral-100 truncate group-hover:text-indigo-600 transition-colors" style={{ width: '6cm', minWidth: '6cm', maxWidth: '6cm' }} title={student.name}>{student.name}</td>
                        {student.scores.map((score, sIdx) => (
                          <td key={sIdx} className="p-1 border-r border-neutral-100">
                            <input 
                              type="text" 
                              value={score}
                              onChange={(e) => updateScore(student.id, sIdx, e.target.value)}
                              className="w-full text-center p-2 text-sm font-bold bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 rounded-lg transition-all text-neutral-700 placeholder-neutral-200"
                              placeholder="-"
                            />
                          </td>
                        ))}
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setStudents(prev => prev.filter(s => s.id !== student.id))}
                            className="text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all p-2 group/del"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-24 text-center">
                          <div className="flex flex-col items-center space-y-6">
                            <div className="relative">
                              <div className="bg-neutral-100 p-8 rounded-full">
                                <Users className="w-12 h-12 text-neutral-300" />
                              </div>
                              <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-md border border-neutral-100">
                                <UserPlus className="w-5 h-5 text-indigo-400" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-black text-neutral-400 uppercase tracking-widest">Danh sách trống</p>
                              <p className="text-sm text-neutral-400 font-medium italic max-w-xs mx-auto">
                                Hãy tải file Excel hoặc nhấn nút bên dưới để thêm học sinh mới vào hệ thống.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Table Actions Row */}
              <div className="p-6 bg-neutral-50/50 border-t border-neutral-200 mt-auto flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setStudents(prev => [...prev, { id: Date.now(), name: 'Học sinh mới', scores: ['', '', '', '', ''] }])}
                  className="flex-1 flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-neutral-300 rounded-2xl text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-white transition-all font-bold text-sm uppercase tracking-widest group"
                >
                  <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>Thêm học sinh mới</span>
                </button>
                
                <button 
                  onClick={() => { if(confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách?')) setStudents([]); }}
                  className="flex items-center justify-center space-x-2 px-6 py-4 border border-neutral-200 rounded-2xl text-neutral-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all font-bold text-sm uppercase tracking-widest group"
                  title="Xóa toàn bộ danh sách"
                >
                  <RotateCcw className="w-5 h-5 group-hover:rotate-[-45deg] transition-transform" />
                  <span className="sm:hidden">Xóa hết</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* About Modal */}
      <AnimatePresence>
        {showAbout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative"
            >
              <button 
                onClick={() => setShowAbout(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
              >
                <Trash2 className="w-6 h-6 rotate-45" />
              </button>
              <h2 className="text-2xl font-black mb-4 text-indigo-600 flex items-center">
                <Sparkles className="w-6 h-6 mr-2 text-yellow-500 fill-current" />
                Vòng Quay May Mắn
              </h2>
              <div className="space-y-4 text-neutral-600 leading-relaxed">
                <p className="flex items-start">
                  <Info className="w-5 h-5 mr-2 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Ứng dụng hỗ trợ giáo viên trong việc gọi tên học sinh ngẫu nhiên và quản lý điểm số thường xuyên (KTTX).</span>
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
                      <Upload className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span>Nhập danh sách từ file Excel (.xlsx)</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
                      <RotateCcw className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span>Vòng quay mượt mà với hiệu ứng vật lý</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
                      <Trash2 className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span>Tự động loại bỏ người đã trúng (tùy chọn)</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
                      <Star className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span>Quản lý 5 cột điểm KTTX</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
                      <Heart className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span>Giao diện hiện đại, dễ sử dụng</span>
                  </li>
                </ul>
                <div className="text-xs pt-4 border-t border-neutral-100 flex items-center justify-between text-neutral-400">
                  <span className="flex items-center"><Code className="w-3 h-3 mr-1" /> Phiên bản 1.0.0</span>
                  <span>Phát triển bởi AI Studio</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
