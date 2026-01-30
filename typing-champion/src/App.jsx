import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:4000');

function App() {
  const [username, setUsername] = useState('');
  const [roomID, setRoomID] = useState(null);
  const [players, setPlayers] = useState([]);
  const [text, setText] = useState('');
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [winnerID, setWinnerID] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [opponentLeft, setOpponentLeft] = useState(false);

  // notification state
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.on('queue_error', (msg) => { setNameError(msg); setIsSearching(false); });

    socket.on('match_found', (data) => {
      setRoomID(data.roomID);
      setPlayers(data.players);
      setIsSearching(false);
      setOpponentLeft(false);
    });

    socket.on('lobby_update', (data) => setPlayers(data.players));

    socket.on('start_countdown', () => {
      let count = 3;
      setCountdown(count);
      const interval = setInterval(() => {
        count -= 1;
        if (count === 0) {
          setCountdown("GO!");
          clearInterval(interval);
        } else {
          setCountdown(count);
        }
      }, 1000);
    });

    socket.on('start_game', (data) => {
      setCountdown(null);
      setGameStarted(true);
      setText(data.text);
      setStartTime(Date.now());
    });

    socket.on('player_progress', ({ id, progress }) => {
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, progress } : p));
    });

    socket.on('game_finished', ({ winnerID }) => {
      setWinnerID(winnerID);
      fetchLeaderboard();
    });

    socket.on('opponent_left', () => {
      setOpponentLeft(true);
    });

    socket.on('receive_message', (data) => {
      setChat(prev => [...prev, data]);
      if (data.username !== username) {
        setHasNewMessage(true);
      }
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    return () => socket.off();
  }, [username]);

  const fetchLeaderboard = async () => {
    const res = await axios.get('http://localhost:4000/api/leaderboard');
    setLeaderboard(res.data);
  };

  const handleInput = async (e) => {
    if (winnerID || opponentLeft) return;
    const val = e.target.value;
    setInput(val);
    const progress = (val.length / text.length) * 100;
    socket.emit('update_progress', { roomID, progress });

    if (val === text) {
      const timeTaken = (Date.now() - startTime) / 1000 / 60;
      const wpm = Math.round((text.trim().split(/\s+/).length) / timeTaken);
      await axios.post('http://localhost:4000/api/scores', { username, wpm, lang: 'en' });
    }
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_room', { roomID });
    window.location.reload();
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!message) return;
    socket.emit('send_message', { roomID, message, username });
    setMessage('');
    setHasNewMessage(false);
  };

  if (!roomID) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-white p-6 bg-slate-950">
        {nameError && (
          <div className="fixed inset-0 bg-black/80 z-200 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-red-500 p-8 rounded-3xl text-center shadow-2xl">
              <h2 className="text-xl font-black mb-4 uppercase text-white tracking-tighter">Name Taken</h2>
              <p className="text-slate-400 mb-6">{nameError}</p>
              <button onClick={() => setNameError(null)} className="w-full bg-red-500 py-3 rounded-xl font-bold uppercase">Try Again</button>
            </div>
          </div>
        )}

        <h1 className="text-8xl font-black mb-12 text-cyan-400 italic tracking-tighter select-none">TYPING CHAM</h1>
        <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl w-full max-w-md text-center">
          <input disabled={isSearching} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-3xl mb-8 focus:ring-2 ring-cyan-500 outline-none text-xl font-bold text-white" placeholder="Racer Name" value={username} onChange={(e) => setUsername(e.target.value)} />
          {!isSearching ? (
            <button onClick={() => { if (!username) return; setIsSearching(true); socket.emit('join_queue', username); }} className="w-full bg-cyan-500 hover:bg-cyan-400 py-5 rounded-3xl text-slate-950 font-black uppercase tracking-widest transition-all">Find Match</button>
          ) : (
            <div className="space-y-4">
              <div className="text-cyan-400 animate-pulse font-bold tracking-widest">Searching...</div>
              <button onClick={() => { setIsSearching(false); socket.emit('leave_queue'); }} className="text-red-500 text-xs font-bold uppercase underline">Cancel Search</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 font-sans">

      {/* countdown */}
      {countdown && (
        <div className="fixed inset-0 bg-cyan-500/90 z-100 flex items-center justify-center text-slate-950 backdrop-blur-sm">
          <h2 className="text-[250px] font-black italic scale-in-center">{countdown}</h2>
        </div>
      )}

      {/* player left modal */}
      {opponentLeft && !winnerID && (
        <div className="fixed inset-0 bg-black/90 z-150 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-red-500 p-10 rounded-[40px] text-center max-w-sm">
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic">Opponent Quit</h2>
            <button onClick={() => window.location.reload()} className="w-full bg-red-500 py-4 rounded-2xl font-black text-white uppercase tracking-widest">Exit to Menu</button>
          </div>
        </div>
      )}

      {/* finish modal */}
      {winnerID && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-110 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-cyan-500 p-10 rounded-[50px] max-w-2xl w-full shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="text-6xl font-black text-white mb-2 uppercase italic">{winnerID === socket.id ? "🏆 VICTORY" : "💀 DEFEAT"}</div>
              <button onClick={() => window.location.reload()} className="bg-cyan-500 px-12 py-4 rounded-2xl font-black text-slate-950 uppercase mt-4 shadow-lg hover:scale-105 transition-all">Start New Match</button>
            </div>
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-center text-cyan-400 font-bold uppercase mb-4 tracking-widest text-xs">Top Speed Racers</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {leaderboard.map((s, i) => (
                  <div key={i} className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-300 font-bold">{i + 1}. {s.username}</span>
                    <span className="text-cyan-400 font-bold font-mono">{s.wpm} WPM</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="lg:col-span-3 space-y-6">
        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl">
          <div className="grid grid-cols-2 gap-8">
            {players.map(p => (
              <div key={p.id} className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-white uppercase text-xs tracking-widest">{p.username} {p.id === socket.id && "(YOU)"}</span>
                  {!gameStarted && (
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${p.isReady ? 'bg-green-500 text-white shadow-[0_0_10px_#22c55e]' : 'bg-slate-800 text-slate-500'}`}>
                      {p.isReady ? 'READY' : 'WAITING'}
                    </span>
                  )}
                </div>
                {gameStarted ? (
                  <div className="h-4 bg-slate-900 rounded-full border border-slate-800 relative p-0.5">
                    <div className="h-full bg-cyan-500 rounded-full transition-all shadow-[0_0_15px_#06b6d4]" style={{ width: `${p.progress}%` }} />
                  </div>
                ) : (
                  p.id === socket.id && (
                    <button onClick={() => { setIsReady(!isReady); socket.emit('toggle_ready', { roomID }); }} className={`w-full py-3 rounded-xl font-bold transition-all uppercase text-sm tracking-widest ${isReady ? 'bg-green-500 text-white shadow-lg' : 'bg-cyan-500 text-slate-950 shadow-lg active:scale-95'}`}>
                      {isReady ? 'Ready Check ✓' : 'Get Ready'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {gameStarted ? (
          <>
            <div className="bg-white text-slate-900 p-14 rounded-[50px] text-4xl leading-relaxed shadow-2xl font-mono select-none">
              {text}
            </div>
            <textarea autoFocus className="w-full h-48 bg-slate-900 border-4 border-slate-800 p-8 rounded-[50px] text-3xl text-white outline-none focus:border-cyan-500 font-mono transition-all" placeholder="Type here..." value={input} onChange={handleInput} />
            <button onClick={handleLeaveRoom} className="px-6 py-2 bg-slate-900 text-red-500 hover:bg-red-500 hover:text-white rounded-full font-bold uppercase text-[10px] transition-all border border-slate-800">Leave Match</button>
          </>
        ) : (
          <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 h-64 rounded-[50px] flex flex-col items-center justify-center text-slate-600 gap-4">
            <p className="font-bold uppercase tracking-[0.3em]">Lobby: Waiting for Players</p>
            <button onClick={handleLeaveRoom} className="px-8 py-3 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-full font-bold uppercase text-[10px] tracking-widest transition-all">Exit Matchmaking</button>
          </div>
        )}
      </div>

      {/* chat */}
      <div className="bg-slate-900 rounded-[40px] border border-slate-800 flex flex-col h-[85vh] relative">
        <div className="p-6 border-b border-slate-800 font-black text-slate-600 uppercase text-[10px] tracking-widest flex items-center">
          Match Chat
          {hasNewMessage && (
            <span className="ml-3 px-2 py-0.5 bg-red-500 text-white text-[8px] rounded-full animate-bounce">
              NEW
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chat.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'}`}>
              <span className="text-[9px] text-slate-600 font-bold uppercase mb-1">{msg.username}</span>
              <div className={`px-4 py-2 rounded-2xl text-sm ${msg.username === username ? 'bg-cyan-500 text-slate-950 font-bold rounded-tr-none' : 'bg-slate-800 text-slate-300 rounded-tl-none'}`}>
                {msg.message}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendChat} className="p-6 bg-slate-950/50 rounded-b-[40px]" onFocus={() => setHasNewMessage(false)}>
          <input className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-white outline-none focus:border-cyan-500 text-xs" placeholder="Talk smack here..." value={message} onChange={(e) => setMessage(e.target.value)} />
        </form>
      </div>
    </div>
  );
}

export default App;