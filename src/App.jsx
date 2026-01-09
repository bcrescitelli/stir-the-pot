import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc,
  collection
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  ChefHat, 
  Skull, 
  Flame, 
  Users, 
  Play, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  Timer,
  ShoppingBasket,
  Trophy,
  ClipboardList,
  Utensils,
  Ban,
  Loader2
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyD_YGPU1QiWCsbKk7i7uLTRdvwNjock5HQ",
  authDomain: "stir-the-pot-game.firebaseapp.com",
  projectId: "stir-the-pot-game",
  storageBucket: "stir-the-pot-game.firebasestorage.app",
  messagingSenderId: "490697693148",
  appId: "1:490697693148:web:3515513c66df65f987e119"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-game';

// --- Game Data ---
const FLAVOR_POOL = {
  Sweet: ["Honey", "Maple Syrup", "Sugar", "Vanilla Bean", "Cocoa Powder", "Date Syrup", "Agave", "Cinnamon", "Strawberry", "Peach"],
  Savory: ["Garlic", "Onion", "Rosemary", "Thyme", "Beef Stock", "Mushrooms", "Black Pepper", "Truffle Oil", "Cumin", "Paprika"],
  Spicy: ["Chili Flakes", "Jalapeño", "Sriracha", "Wasabi", "Habanero", "Ginger", "Cayenne", "Black Mustard Seed", "Horseradish", "Chipotle"],
  Sour: ["Lemon Juice", "Lime Zest", "Vinegar", "Green Apple", "Yogurt", "Tamarind", "Pickle Brine", "Kalamansi", "Sumac", "Kimchi Juice"],
  Umami: ["Soy Sauce", "Miso Paste", "Worcestershire Sauce", "Nutritional Yeast", "Dried Seaweed", "Parmesan", "Anchovies", "Tomato Paste", "Bonito Flakes", "Fish Sauce"],
  Bitter: ["Dark Chocolate", "Coffee Grounds", "Kale", "Grapefruit Peel", "Turmeric", "Dandelion Greens", "Matcha", "Beer", "Radicchio", "Cranberry"]
};

const TAINTED_INGREDIENTS = [
  "Motor Oil", "Old Gym Sock", "High Fructose Corn Syrup", "Industrial Sludge", 
  "Expired Milk", "Rusty Nails", "Dish Soap", "Blue Paint", "Lawn Clippings", 
  "Moldy Bread", "Hairball", "Mystery Goo", "Laundry Detergent", "Pesticide"
];

const CATEGORIES = Object.keys(FLAVOR_POOL);

// --- Utilities ---
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();
const getRandomItem = (arr) => arr[arr.length > 0 ? Math.floor(Math.random() * arr.length) : 0];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Initialize Auth (Strict Compliance with Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("Auth token mismatch or error, using anonymous:", err.message);
        try { await signInAnonymously(auth); } catch (e) {}
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Sync Room Data (Rule 1 & 2)
  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.data());
      } else if (view !== 'landing') {
        setError("Room closed.");
        setView('landing');
      }
    }, (err) => {
      console.error("Firestore sync error:", err);
      setError("Sync lost. Refresh page.");
    });
    return () => unsubscribe();
  }, [user, roomCode, view]);

  const handleCreateRoom = async () => {
    if (!user) return; // Guard per Rule 3
    setIsBusy(true);
    const code = generateRoomCode();
    const initialRoomState = {
      code,
      state: 'LOBBY',
      players: {},
      hostId: user.uid,
      currentRecipe: [],
      pot: [],
      stinkMeter: 0,
      round: 0,
      scores: {},
      lastUpdated: Date.now()
    };
    
    try {
      // Rule 1 Compliant Path
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      await setDoc(roomRef, initialRoomState);
      setRoomCode(code);
      setView('host');
      setError('');
    } catch (err) {
      console.error("Firebase Error:", err);
      setError("Failed to create room. Permissions or connection issue.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinRoom = async (code) => {
    if (!user) return; // Guard per Rule 3
    const upperCode = code.trim().toUpperCase();
    if (!upperCode) return;
    setIsBusy(true);

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', upperCode);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("Room not found.");
        setIsBusy(false);
        return;
      }
      if (snap.data().state !== 'LOBBY') {
        setError("Game in progress.");
        setIsBusy(false);
        return;
      }
      await updateDoc(roomRef, {
        [`players.${user.uid}`]: {
          id: user.uid,
          name: playerName || `Chef ${Math.floor(Math.random() * 900) + 100}`,
          role: 'CHEF',
          hand: [],
          score: 0,
          joinedAt: Date.now()
        }
      });
      setRoomCode(upperCode);
      setView('player');
      setError('');
    } catch (err) {
      setError("Error joining room.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomData) return;
    const playerIds = Object.keys(roomData.players);
    if (playerIds.length < 3) {
      setError("Need at least 3 chefs!");
      return;
    }
    const shuffledIds = shuffle(playerIds);
    const saboteurId = shuffledIds[0];
    const newPlayers = { ...roomData.players };
    shuffledIds.forEach((id) => {
      const isSab = id === saboteurId;
      newPlayers[id].role = isSab ? 'SABOTEUR' : 'CHEF';
      const hand = [];
      for(let i=0; i<6; i++) {
        const cat = getRandomItem(CATEGORIES);
        hand.push(isSab 
          ? { name: getRandomItem(TAINTED_INGREDIENTS), category: cat, type: 'TAINTED' }
          : { name: getRandomItem(FLAVOR_POOL[cat]), category: cat, type: 'CLEAN' }
        );
      }
      newPlayers[id].hand = hand;
    });
    const recipe = Array.from({ length: 6 }, () => getRandomItem(CATEGORIES));
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), {
      state: 'ROUND1',
      players: newPlayers,
      currentRecipe: recipe,
      recipeIndex: 0,
      pot: [],
      stinkMeter: 0,
      round: (roomData.round || 0) + 1,
      votes: {}
    });
  };

  const handlePlayCard = async (cardIndex) => {
    if (!roomData || !user) return;
    const player = roomData.players[user.uid];
    const card = player.hand[cardIndex];
    if (!card) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);
    const newCat = getRandomItem(CATEGORIES);
    newHand.push(player.role === 'SABOTEUR'
      ? { name: getRandomItem(TAINTED_INGREDIENTS), category: newCat, type: 'TAINTED' }
      : { name: getRandomItem(FLAVOR_POOL[newCat]), category: newCat, type: 'CLEAN' }
    );
    const targetCategory = roomData.currentRecipe[roomData.recipeIndex];
    let points = 0;
    let newStink = roomData.stinkMeter;
    if (card.type === 'TAINTED') { newStink += 25; points = -15; }
    else if (card.category === targetCategory) { points = 10; }
    else { points = 2; }
    const updates = {
      [`players.${user.uid}.hand`]: newHand,
      [`players.${user.uid}.score`]: player.score + points,
      pot: [...roomData.pot, { ...card, playedBy: user.uid, playerName: player.name }],
      stinkMeter: newStink,
      recipeIndex: roomData.recipeIndex + 1
    };
    if (newStink >= 100) { updates.state = 'TASTE_TEST'; }
    else if (roomData.recipeIndex + 1 >= roomData.currentRecipe.length) { updates.state = 'ROUND_END'; }
    await updateDoc(roomRef, updates);
  };

  const handleVote = async (targetId) => {
    if (!roomData || !user || roomData.votes?.[user.uid]) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const currentVotes = { ...(roomData.votes || {}), [user.uid]: targetId };
    await updateDoc(roomRef, { votes: currentVotes });
    const totalPlayers = Object.keys(roomData.players).length;
    if (Object.keys(currentVotes).length >= totalPlayers) {
      const tallies = {};
      Object.values(currentVotes).forEach(v => tallies[v] = (tallies[v] || 0) + 1);
      const sorted = Object.entries(tallies).sort((a,b) => b[1] - a[1]);
      const topVoted = sorted[0][0];
      const saboteur = Object.values(roomData.players).find(p => p.role === 'SABOTEUR');
      await updateDoc(roomRef, {
        state: 'VOTE_REVEAL',
        voteWinner: topVoted,
        voteSuccess: topVoted === saboteur?.id
      });
    }
  };

  // --- RENDERING ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] max-w-sm w-full border-b-[12px] border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-orange-500 p-4 rounded-3xl shadow-[0_10px_0_rgb(194,65,12)] mb-4">
              <Utensils size={48} className="text-white" />
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase text-center">STIR THE POT</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Kitchen Chaos Simulator</p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Chef Callsign</label>
              <input 
                className="w-full p-5 bg-slate-50 border-4 border-slate-100 rounded-2xl font-black text-xl focus:border-orange-500 outline-none transition-all placeholder:text-slate-300" 
                placeholder="E.G. RAMSAY" 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)} 
              />
            </div>
            
            <div className="space-y-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Room Code</label>
                  <input 
                    className="w-full p-5 bg-slate-50 border-4 border-slate-100 rounded-2xl font-black text-2xl uppercase tracking-[0.3em] text-center focus:border-orange-500 outline-none transition-all" 
                    placeholder="----" 
                    maxLength={4} 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
                  />
               </div>
               
               <button 
                  disabled={!user || isBusy || !roomCode}
                  onClick={() => handleJoinRoom(roomCode)} 
                  className="w-full py-5 bg-orange-500 text-white font-black rounded-2xl shadow-[0_8px_0_rgb(194,65,12)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
               >
                  {isBusy ? <Loader2 className="animate-spin" /> : <Users size={20} />} JOIN KITCHEN
                </button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase font-black text-slate-300">
                <span className="bg-white px-2">OR</span>
              </div>
            </div>

            <button 
              disabled={!user || isBusy}
              onClick={handleCreateRoom} 
              className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_0_rgb(30,41,59)] active:shadow-none active:translate-y-1 transition-all hover:bg-slate-800 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
            >
              {isBusy ? <Loader2 className="animate-spin" /> : <ChefHat size={20} className="text-orange-400" />} HOST A TABLE
            </button>
          </div>
          {error && <div className="mt-6 p-4 bg-red-50 text-red-600 text-xs font-black rounded-xl border-2 border-red-100 text-center uppercase tracking-wider">{error}</div>}
        </div>
      </div>
    );
  }

  if (view === 'host' && roomData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-12 flex flex-col font-sans">
        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-between">
            <div className="text-center">
              <span className="bg-orange-500 text-white px-6 py-2 rounded-full font-black uppercase tracking-[0.3em] text-sm shadow-xl">Join the Kitchen</span>
              <h2 className="text-[15rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_20px_50px_rgba(255,255,255,0.1)]">{roomCode}</h2>
            </div>
            
            <div className="w-full max-w-6xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-white/10" />
                <span className="font-black uppercase tracking-widest text-white/30 text-xl flex items-center gap-3">
                  <Users /> {Object.keys(roomData.players).length} Chefs Clocked In
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {Object.values(roomData.players).map((p) => (
                  <div key={p.id} className="bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border-2 border-white/5 flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                    <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-4xl shadow-[0_8px_0_rgb(194,65,12)] font-black">
                      {p.name[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-black text-2xl truncate w-full text-center tracking-tight">{p.name}</span>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 3 - Object.keys(roomData.players).length) }).map((_, i) => (
                  <div key={i} className="border-4 border-dashed border-white/10 rounded-[2rem] flex items-center justify-center p-8 opacity-20">
                    <ChefHat size={48} />
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleStartGame} 
              disabled={Object.keys(roomData.players).length < 3} 
              className="group bg-white text-slate-900 px-20 py-8 rounded-full font-black text-4xl shadow-[0_12px_0_rgb(203,213,225)] active:shadow-none active:translate-y-2 transition-all disabled:opacity-30 disabled:translate-y-0 disabled:shadow-none flex items-center gap-6"
            >
              <Play size={40} className="fill-current" /> CLOCK IN
            </button>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 flex flex-col gap-12 max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-12 gap-12 flex-1">
              <div className="col-span-8 flex flex-col gap-8">
                <div className="bg-white/5 rounded-[4rem] border-2 border-white/5 p-16 relative flex flex-col items-center justify-center overflow-hidden">
                   <div className="absolute top-12 left-16">
                      <div className="flex items-center gap-3 text-orange-400 mb-2">
                        <Utensils size={24} />
                        <span className="font-black uppercase tracking-[0.3em] text-lg">Order #0{roomData.round}</span>
                      </div>
                      <h3 className="text-6xl font-black italic tracking-tighter text-white/90">The Rush Hour Broth</h3>
                   </div>

                   <div className="relative">
                      <div className={`absolute inset-0 rounded-full blur-[120px] transition-all duration-1000 ${roomData.stinkMeter > 50 ? 'bg-red-500/40' : 'bg-orange-500/20'}`}></div>
                      <div className="relative z-10 scale-125">
                         <Flame size={180} className={`${roomData.stinkMeter > 50 ? 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]'} animate-pulse`} />
                      </div>
                   </div>

                   <div className="mt-20 text-center">
                      <p className="text-white/40 font-black uppercase tracking-[0.5em] mb-4 text-xl">Calling For:</p>
                      <div className="bg-white text-slate-950 px-12 py-6 rounded-3xl inline-block shadow-[0_10px_0_rgb(203,213,225)]">
                        <h2 className="text-8xl font-black uppercase tracking-tighter">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
                      </div>
                   </div>
                </div>

                <div className="bg-[#f3f4f6] text-slate-900 p-8 rounded-3xl shadow-inner font-mono flex items-center gap-8 overflow-hidden relative">
                   <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-slate-200 to-transparent z-10" />
                   <span className="shrink-0 font-black text-slate-400 uppercase tracking-widest text-sm transform -rotate-90">Receipt</span>
                   <div className="flex gap-4 items-center animate-in slide-in-from-right duration-700">
                      {roomData.pot.slice(-10).reverse().map((ing, i) => (
                        <div key={i} className={`px-6 py-4 rounded-xl border-2 flex flex-col ${ing.type === 'TAINTED' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                           <span className="text-[10px] uppercase font-black opacity-40 leading-none mb-1">{ing.category}</span>
                           <span className={`font-black text-lg ${ing.type === 'TAINTED' ? 'text-red-600' : 'text-slate-800'}`}>{ing.name}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="col-span-4 flex flex-col gap-8">
                 <div className="bg-white/5 rounded-[3rem] p-10 border-2 border-white/5">
                    <div className="flex justify-between items-end mb-6">
                       <div>
                        <h4 className="text-white/40 font-black uppercase tracking-widest text-xs mb-1">Kitchen Quality</h4>
                        <span className={`text-4xl font-black ${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-green-400'}`}>
                          {100 - roomData.stinkMeter}% CLEAN
                        </span>
                       </div>
                       <AlertTriangle className={roomData.stinkMeter > 50 ? 'text-red-500 animate-pulse' : 'text-white/10'} />
                    </div>
                    <div className="w-full h-16 bg-black/40 rounded-3xl p-2 relative overflow-hidden border border-white/10">
                       <div 
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600 rounded-2xl transition-all duration-1000"
                        style={{ width: `${roomData.stinkMeter}%` }}
                       />
                    </div>
                 </div>

                 <div className="bg-white/5 rounded-[3rem] p-10 border-2 border-white/5 flex-1">
                    <h4 className="text-white/40 font-black uppercase tracking-widest text-xs mb-8 flex items-center gap-2">
                      <Trophy size={14} /> Top Performers
                    </h4>
                    <div className="space-y-4">
                      {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, idx) => (
                        <div key={p.id} className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5 transform transition hover:scale-105">
                           <div className="flex items-center gap-4">
                              <span className="text-white/20 font-black italic text-xl">#{idx + 1}</span>
                              <span className="font-black text-xl">{p.name}</span>
                           </div>
                           <span className="text-orange-400 font-black text-xl tabular-nums">{p.score}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12">
            <div className="text-center">
               <div className="bg-red-500 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-[0_0_80px_rgba(239,68,68,0.6)]">
                 <Skull size={80} className="text-white" />
               </div>
               <h2 className="text-9xl font-black text-white italic tracking-tighter">CONTAMINATION ALERT!</h2>
               <p className="text-3xl text-white/40 font-bold uppercase tracking-[0.3em]">Identify the Saboteur Immediately</p>
            </div>
            
            <div className="bg-white p-12 rounded-[4rem] text-slate-900 w-full max-w-5xl shadow-2xl relative">
              <div className="absolute top-0 right-12 transform -translate-y-1/2 bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest">Inspection Report</div>
              <div className="grid grid-cols-5 gap-6">
                {roomData.pot.slice(-5).map((ing, i) => (
                  <div key={i} className={`p-8 rounded-3xl border-4 text-center space-y-3 ${ing.type === 'TAINTED' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-xs font-black uppercase tracking-tighter">{ing.category}</div>
                    <div className="text-2xl font-black leading-tight">{ing.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(roomData.state === 'VOTE_REVEAL' || roomData.state === 'ROUND_END') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 animate-in fade-in zoom-in duration-1000">
              <div className="space-y-4">
                <span className="bg-white/10 text-white/50 px-8 py-3 rounded-full font-black uppercase tracking-widest text-lg">Shift Review</span>
                <h2 className="text-[12rem] font-black italic tracking-tighter leading-none">
                  {roomData.state === 'ROUND_END' ? '5 STARS!' : roomData.voteSuccess ? 'TERMINATED!' : 'MISFIRE!'}
                </h2>
                <div className="text-4xl bg-orange-500 text-white p-10 rounded-[3rem] inline-block shadow-[0_15px_0_rgb(194,65,12)] transform rotate-2">
                   {roomData.state === 'ROUND_END' 
                    ? "THE BROTH WAS DELICIOUS!" 
                    : `THE SABOTEUR WAS ${Object.values(roomData.players).find(p => p.role === 'SABOTEUR')?.name?.toUpperCase()}!`}
                </div>
              </div>
              <button 
                onClick={handleStartGame} 
                className="bg-white text-slate-900 px-24 py-10 rounded-full font-black text-5xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110 shadow-[0_15px_0_rgb(203,213,225)] active:translate-y-2 active:shadow-none"
              >
                <RotateCcw size={48} className="inline mr-4" /> NEXT SHIFT
              </button>
           </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[user.uid];
    if (!me) return <div className="p-10 text-center font-bold">Connecting...</div>;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-6 font-sans select-none overflow-hidden">
        <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-[2rem] shadow-sm border-b-4 border-slate-200">
          <div className="flex items-center gap-4">
             <div className={`p-3 rounded-2xl ${me.role === 'SABOTEUR' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {me.role === 'SABOTEUR' ? <Skull size={28} /> : <ChefHat size={28} />}
             </div>
             <div>
               <h3 className="font-black text-slate-900 text-xl leading-none">{me.name}</h3>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{me.role === 'SABOTEUR' ? 'SABOTEUR' : 'CHEF'}</span>
             </div>
          </div>
          <div className="text-right">
             <span className="text-3xl font-black text-slate-900 tabular-nums">{me.score}</span>
          </div>
        </div>

        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-8 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border-b-8 border-slate-200">
              <ChefHat size={80} className="text-orange-500 animate-bounce mb-6 mx-auto" />
              <h2 className="text-4xl font-black text-slate-900 mb-2">YOU'RE CLOCKED IN</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Wait for the head chef...</p>
            </div>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 transform rotate-12 scale-150">
                <Utensils size={100} />
              </div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] mb-2">Pot Needs:</p>
              <h2 className="text-5xl font-black tracking-tighter uppercase">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
            </div>
            
            <p className="px-2 mb-4 text-xs font-black uppercase text-slate-400 tracking-widest">Your Cards</p>
            
            <div className="grid grid-cols-2 gap-4 flex-1 pb-4">
              {(me.hand || []).map((card, idx) => (
                <button 
                  key={idx} 
                  onClick={() => handlePlayCard(idx)} 
                  className={`relative p-6 rounded-[2rem] border-b-[8px] text-left h-full flex flex-col justify-between active:scale-95 active:translate-y-2 transition-all shadow-lg ${
                    me.role === 'SABOTEUR' 
                      ? 'bg-slate-800 border-slate-950 text-white' 
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest ${me.role === 'SABOTEUR' ? 'text-red-400' : 'text-orange-500'}`}>
                    {card.category}
                  </span>
                  <span className="font-black text-xl leading-none pr-2">{card.name}</span>
                  {me.role === 'SABOTEUR' && <Skull size={16} className="absolute bottom-4 right-4 opacity-20" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-4 pt-4">
             <div className="bg-red-600 p-8 rounded-[2rem] text-white text-center shadow-xl mb-4">
               <Skull size={40} className="mx-auto mb-3" />
               <h2 className="text-3xl font-black italic tracking-tighter">EXPOSE THEM!</h2>
             </div>
             <div className="space-y-3">
               {Object.values(roomData.players).filter(p => p.id !== user.uid).map(p => (
                 <button 
                  key={p.id} 
                  onClick={() => handleVote(p.id)} 
                  disabled={!!roomData.votes?.[user.uid]} 
                  className={`w-full p-6 rounded-3xl border-b-8 font-black text-2xl transition-all flex items-center justify-between ${
                    roomData.votes?.[user.uid] === p.id 
                      ? 'bg-red-500 border-red-700 text-white translate-y-2 shadow-none' 
                      : 'bg-white border-slate-200 text-slate-900 shadow-lg active:translate-y-2 active:shadow-none'
                  }`}
                 >
                   {p.name}
                   {roomData.votes?.[user.uid] === p.id && <CheckCircle size={28} />}
                 </button>
               ))}
             </div>
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-in zoom-in duration-500">
                 <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border-b-[12px] border-slate-100">
                    <div className="bg-slate-900 w-24 h-24 rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-xl">
                      <RotateCcw size={48} className="animate-spin-slow" />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">SHIFT CONCLUDED</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">Checking the cameras...</p>
                 </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-6">
        <Flame size={64} className="text-orange-500 animate-pulse" />
        <div className="h-2 w-48 bg-white/10 rounded-full overflow-hidden">
           <div className="h-full bg-orange-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '30%' }} />
        </div>
      </div>
    </div>
  );
}