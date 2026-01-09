import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc
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
  Utensils,
  Loader2,
  ChevronRight
} from 'lucide-react';

// --- Firebase Configuration ---
const userFirebaseConfig = {
  apiKey: "AIzaSyD_YGPU1QiWCsbKk7i7uLTRdvwNjock5HQ",
  authDomain: "stir-the-pot-game.firebaseapp.com",
  projectId: "stir-the-pot-game",
  storageBucket: "stir-the-pot-game.firebasestorage.app",
  messagingSenderId: "490697693148",
  appId: "1:490697693148:web:3515513c66df65f987e119"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Logic: If using the hardcoded config, use a fixed appId for consistency.
// If in the preview environment using system config, use the provided __app_id.
const rawAppId = typeof __firebase_config === 'undefined' 
  ? 'stir-the-pot-game' 
  : (typeof __app_id !== 'undefined' ? __app_id : 'stir-the-pot-game');

const appId = rawAppId.replace(/\//g, '_');

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
  const [authInited, setAuthInited] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("Auth fallback triggered:", err.message);
        try { 
          await signInAnonymously(auth); 
        } catch (e) {
          console.error("Auth Failed:", e);
        }
      } finally {
        setAuthInited(true);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.data());
      } else if (view !== 'landing') {
        setError("This table has been closed.");
        setView('landing');
      }
    }, (err) => {
      console.error("Firestore sync error:", err);
      if (err.code === 'permission-denied') {
        setError(`Access Denied: Check rules for path artifacts/${appId}`);
      }
    });
    return () => unsubscribe();
  }, [user, roomCode, view]);

  const handleCreateRoom = async () => {
    if (!auth.currentUser) {
      setError("Still connecting to kitchen server...");
      return;
    }

    setIsBusy(true);
    const code = generateRoomCode();
    const initialRoomState = {
      code,
      state: 'LOBBY',
      players: {},
      hostId: auth.currentUser.uid,
      currentRecipe: [],
      pot: [],
      stinkMeter: 0,
      round: 0,
      scores: {},
      lastUpdated: Date.now()
    };
    
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      await setDoc(roomRef, initialRoomState);
      setRoomCode(code);
      setView('host');
      setError('');
    } catch (err) {
      console.error("Firebase Create Error:", err);
      setError(`Permission Error: Rules must allow writes to artifacts/${appId}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinRoom = async (code) => {
    if (!auth.currentUser) {
      setError("Still connecting to kitchen server...");
      return;
    }
    const upperCode = code.trim().toUpperCase();
    if (!upperCode) return;
    setIsBusy(true);

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', upperCode);
    try {
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setError("Table not found. Check the code.");
        setIsBusy(false);
        return;
      }
      const data = snap.data();
      if (data.state !== 'LOBBY') {
        setError("Dinner service has already started.");
        setIsBusy(false);
        return;
      }
      await updateDoc(roomRef, {
        [`players.${auth.currentUser.uid}`]: {
          id: auth.currentUser.uid,
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
      console.error("Firebase Join Error:", err);
      setError(`Join Error: Database access denied.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomData || !auth.currentUser) return;
    const playerIds = Object.keys(roomData.players);
    if (playerIds.length < 3) {
      setError("We need at least 3 chefs for this shift!");
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
    if (!roomData || !auth.currentUser) return;
    const player = roomData.players[auth.currentUser.uid];
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
      [`players.${auth.currentUser.uid}.hand`]: newHand,
      [`players.${auth.currentUser.uid}.score`]: player.score + points,
      pot: [...roomData.pot, { ...card, playedBy: auth.currentUser.uid, playerName: player.name }],
      stinkMeter: newStink,
      recipeIndex: roomData.recipeIndex + 1
    };
    if (newStink >= 100) { updates.state = 'TASTE_TEST'; }
    else if (roomData.recipeIndex + 1 >= roomData.currentRecipe.length) { updates.state = 'ROUND_END'; }
    await updateDoc(roomRef, updates);
  };

  const handleVote = async (targetId) => {
    if (!roomData || !auth.currentUser || roomData.votes?.[auth.currentUser.uid]) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const currentVotes = { ...(roomData.votes || {}), [auth.currentUser.uid]: targetId };
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
          <div className="flex flex-col items-center mb-10">
            <div className="bg-orange-500 p-5 rounded-[2rem] shadow-[0_10px_0_rgb(194,65,12)] mb-6">
              <Utensils size={52} className="text-white" />
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase text-center leading-none mb-2">STIR THE POT</h1>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Industrial Kitchen Chaos</p>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic">Chef Callsign</label>
              <input 
                className="w-full p-5 bg-slate-50 border-4 border-slate-100 rounded-[1.5rem] font-black text-xl focus:border-orange-500 outline-none transition-all placeholder:text-slate-300" 
                placeholder="Gordon R." 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)} 
              />
            </div>
            
            <div className="bg-slate-50 p-6 rounded-[2rem] border-4 border-slate-100 space-y-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic text-center block">Enter Table Code</label>
                  <input 
                    className="w-full p-4 bg-white border-4 border-slate-100 rounded-2xl font-black text-3xl uppercase tracking-[0.4em] text-center focus:border-orange-500 outline-none transition-all" 
                    placeholder="----" 
                    maxLength={4} 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
                  />
               </div>
               
               <button 
                  disabled={!authInited || isBusy || !roomCode}
                  onClick={() => handleJoinRoom(roomCode)} 
                  className="w-full py-5 bg-orange-500 text-white font-black rounded-2xl shadow-[0_8px_0_rgb(194,65,12)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none text-lg"
               >
                  {isBusy ? <Loader2 className="animate-spin" /> : <ChevronRight size={24} />} JOIN THE LINE
                </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t-4 border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Management</span>
              <div className="flex-grow border-t-4 border-slate-100"></div>
            </div>

            <button 
              disabled={!authInited || isBusy}
              onClick={handleCreateRoom} 
              className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-[0_8px_0_rgb(30,41,59)] active:shadow-none active:translate-y-1 transition-all hover:bg-slate-800 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none text-lg"
            >
              {isBusy ? <Loader2 className="animate-spin" /> : <ChefHat size={24} className="text-orange-400" />} OPEN A TABLE
            </button>
          </div>
          
          {error && (
            <div className="mt-8 p-4 bg-red-50 border-2 border-red-100 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-500" />
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">Kitchen Alert</span>
              </div>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight leading-tight">{error}</p>
            </div>
          )}
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
              <span className="bg-orange-500 text-white px-8 py-2 rounded-full font-black uppercase tracking-[0.4em] text-sm shadow-xl italic">Table Code</span>
              <h2 className="text-[15rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_20px_50px_rgba(255,255,255,0.1)]">{roomCode}</h2>
            </div>
            
            <div className="w-full max-w-6xl">
              <div className="flex items-center gap-4 mb-8 text-white/20">
                <div className="h-1 flex-1 bg-white/10 rounded-full" />
                <span className="font-black uppercase tracking-[0.3em] text-xl flex items-center gap-4">
                  <Users size={28} /> {Object.keys(roomData.players).length} Chefs Ready
                </span>
                <div className="h-1 flex-1 bg-white/10 rounded-full" />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                {Object.values(roomData.players).map((p) => (
                  <div key={p.id} className="bg-white/5 backdrop-blur-md p-10 rounded-[2.5rem] border-2 border-white/5 flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                    <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center text-5xl shadow-[0_10px_0_rgb(194,65,12)] font-black italic">
                      {p.name[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-black text-3xl truncate w-full text-center tracking-tight leading-none italic">{p.name}</span>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 3 - Object.keys(roomData.players).length) }).map((_, i) => (
                  <div key={i} className="border-4 border-dashed border-white/10 rounded-[2.5rem] flex items-center justify-center p-10 opacity-20">
                    <ChefHat size={64} />
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={handleStartGame} 
              disabled={Object.keys(roomData.players).length < 3} 
              className="group bg-white text-slate-900 px-24 py-10 rounded-full font-black text-5xl shadow-[0_15px_0_rgb(203,213,225)] active:translate-y-2 active:shadow-none transition-all disabled:opacity-30 disabled:translate-y-0 disabled:shadow-none flex items-center gap-8 italic"
            >
              <Play size={48} className="fill-current" /> START SERVICE
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
                        <span className="font-black uppercase tracking-[0.3em] text-lg italic">Order #0{roomData.round}</span>
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
                      <p className="text-white/40 font-black uppercase tracking-[0.5em] mb-4 text-xl italic">Calling For:</p>
                      <div className="bg-white text-slate-950 px-16 py-8 rounded-[2rem] inline-block shadow-[0_12px_0_rgb(203,213,225)]">
                        <h2 className="text-9xl font-black uppercase tracking-tighter italic">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
                      </div>
                   </div>
                </div>

                <div className="bg-[#f3f4f6] text-slate-900 p-8 rounded-3xl shadow-inner font-mono flex items-center gap-8 overflow-hidden relative">
                   <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-slate-200 to-transparent z-10" />
                   <span className="shrink-0 font-black text-slate-400 uppercase tracking-widest text-sm transform -rotate-90 italic">Kitchen Receipt</span>
                   <div className="flex gap-6 items-center animate-in slide-in-from-right duration-700">
                      {roomData.pot.slice(-10).reverse().map((ing, i) => (
                        <div key={i} className={`px-8 py-5 rounded-2xl border-4 flex flex-col min-w-[140px] ${ing.type === 'TAINTED' ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                           <span className="text-[11px] uppercase font-black opacity-50 leading-none mb-1 tracking-tighter italic">{ing.category}</span>
                           <span className={`font-black text-xl italic ${ing.type === 'TAINTED' ? 'text-red-600' : 'text-slate-800'}`}>{ing.name}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="col-span-4 flex flex-col gap-8">
                 <div className="bg-white/5 rounded-[3rem] p-10 border-2 border-white/5">
                    <div className="flex justify-between items-end mb-6">
                       <div>
                        <h4 className="text-white/40 font-black uppercase tracking-widest text-xs mb-1 italic">Pot Quality</h4>
                        <span className={`text-5xl font-black italic tracking-tighter ${roomData.stinkMeter > 50 ? 'text-red-500' : 'text-green-400'}`}>
                          {100 - roomData.stinkMeter}% CLEAN
                        </span>
                       </div>
                       <AlertTriangle className={roomData.stinkMeter > 50 ? 'text-red-500 animate-pulse' : 'text-white/10'} size={32} />
                    </div>
                    <div className="w-full h-20 bg-black/40 rounded-[2rem] p-2 relative overflow-hidden border border-white/10">
                       <div 
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-600 rounded-2xl transition-all duration-1000 shadow-lg"
                        style={{ width: `${roomData.stinkMeter}%` }}
                       />
                    </div>
                 </div>

                 <div className="bg-white/5 rounded-[3rem] p-10 border-2 border-white/5 flex-1">
                    <h4 className="text-white/40 font-black uppercase tracking-widest text-xs mb-8 flex items-center gap-2 italic">
                      <Trophy size={16} /> Lead Cooks
                    </h4>
                    <div className="space-y-6">
                      {Object.values(roomData.players).sort((a,b) => b.score - a.score).map((p, idx) => (
                        <div key={p.id} className="flex justify-between items-center bg-white/5 p-6 rounded-[1.5rem] border border-white/5 transform transition hover:scale-105 shadow-lg">
                           <div className="flex items-center gap-5">
                              <span className="text-white/20 font-black italic text-2xl">#{idx + 1}</span>
                              <span className="font-black text-2xl italic tracking-tight">{p.name}</span>
                           </div>
                           <span className="text-orange-400 font-black text-3xl tabular-nums italic tracking-tighter">{p.score}</span>
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
               <div className="bg-red-500 w-40 h-40 rounded-full flex items-center justify-center mx-auto mb-10 animate-pulse shadow-[0_0_100px_rgba(239,68,68,0.7)]">
                 <Skull size={100} className="text-white" />
               </div>
               <h2 className="text-[10rem] font-black text-white italic tracking-tighter leading-none mb-4">HEALTH INSPECTION!</h2>
               <p className="text-4xl text-white/40 font-bold uppercase tracking-[0.4em] italic">Expose the saboteur immediately</p>
            </div>
            
            <div className="bg-white p-16 rounded-[4rem] text-slate-900 w-full max-w-6xl shadow-2xl relative border-b-[20px] border-slate-200">
              <div className="absolute top-0 right-16 transform -translate-y-1/2 bg-red-600 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xl italic shadow-lg">Evidence Log</div>
              <div className="grid grid-cols-5 gap-8">
                {roomData.pot.slice(-5).map((ing, i) => (
                  <div key={i} className={`p-10 rounded-[2.5rem] border-4 text-center space-y-4 shadow-sm ${ing.type === 'TAINTED' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-xs font-black uppercase tracking-widest italic">{ing.category}</div>
                    <div className="text-3xl font-black leading-tight italic tracking-tighter">{ing.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(roomData.state === 'VOTE_REVEAL' || roomData.state === 'ROUND_END') && (
           <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in fade-in zoom-in duration-1000">
              <div className="space-y-6">
                <span className="bg-white/10 text-white/50 px-10 py-4 rounded-full font-black uppercase tracking-[0.5em] text-2xl italic">Shift Report</span>
                <h2 className="text-[13rem] font-black italic tracking-tighter leading-none text-white drop-shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
                  {roomData.state === 'ROUND_END' ? '5 STARS!' : roomData.voteSuccess ? 'FIRED!' : 'WRONG CHEF!'}
                </h2>
                <div className="text-5xl bg-orange-500 text-white p-12 rounded-[3.5rem] inline-block shadow-[0_20px_0_rgb(194,65,12)] transform rotate-2 italic font-black tracking-tight">
                   {roomData.state === 'ROUND_END' 
                    ? "KITCHEN MAINTAINED STANDARDS!" 
                    : `THE MOLE WAS ${Object.values(roomData.players).find(p => p.role === 'SABOTEUR')?.name?.toUpperCase()}!`}
                </div>
              </div>
              <button 
                onClick={handleStartGame} 
                className="bg-white text-slate-900 px-28 py-12 rounded-full font-black text-6xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110 shadow-[0_20px_0_rgb(203,213,225)] active:translate-y-3 active:shadow-none italic"
              >
                <RotateCcw size={56} className="inline mr-6" /> NEXT TICKET
              </button>
           </div>
        )}
      </div>
    );
  }

  if (view === 'player' && roomData) {
    const me = roomData.players[auth.currentUser?.uid];
    if (!me) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black italic text-2xl animate-pulse">RECLOCKING IN...</div>;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-6 font-sans select-none overflow-hidden italic">
        <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-[2rem] shadow-sm border-b-8 border-slate-200">
          <div className="flex items-center gap-4">
             <div className={`p-4 rounded-2xl shadow-inner ${me.role === 'SABOTEUR' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {me.role === 'SABOTEUR' ? <Skull size={32} /> : <ChefHat size={32} />}
             </div>
             <div>
               <h3 className="font-black text-slate-900 text-2xl leading-none tracking-tight">{me.name}</h3>
               <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] italic">{me.role === 'SABOTEUR' ? 'SABOTEUR' : 'LINE COOK'}</span>
             </div>
          </div>
          <div className="text-right">
             <span className="text-4xl font-black text-slate-950 tabular-nums tracking-tighter">{me.score}</span>
          </div>
        </div>

        {roomData.state === 'LOBBY' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-10 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border-b-[12px] border-slate-200 w-full">
              <ChefHat size={100} className="text-orange-500 animate-bounce mb-8 mx-auto" />
              <h2 className="text-5xl font-black text-slate-900 mb-3 tracking-tighter">CLOCKED IN</h2>
              <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">Waiting for Head Chef to open service</p>
            </div>
          </div>
        )}

        {roomData.state === 'ROUND1' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-10 bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-b-[12px] border-slate-950">
              <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12 scale-150">
                <Utensils size={120} />
              </div>
              <p className="text-[11px] font-black text-orange-400 uppercase tracking-[0.4em] mb-3 italic">Active Order Needs:</p>
              <h2 className="text-6xl font-black tracking-tighter uppercase leading-none">{roomData.currentRecipe[roomData.recipeIndex] || 'DONE'}</h2>
            </div>
            
            <div className="flex justify-between items-center px-4 mb-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Kitchen Inventory</span>
              <span className="text-[10px] font-black uppercase text-orange-500 animate-pulse">Select Flavor</span>
            </div>
            
            <div className="grid grid-cols-2 gap-5 flex-1 pb-6">
              {(me.hand || []).map((card, idx) => (
                <button 
                  key={idx} 
                  onClick={() => handlePlayCard(idx)} 
                  className={`relative p-7 rounded-[2.5rem] border-b-[12px] text-left h-full flex flex-col justify-between active:scale-95 active:translate-y-3 transition-all shadow-xl ${
                    me.role === 'SABOTEUR' 
                      ? 'bg-slate-800 border-slate-950 text-white shadow-slate-950/20' 
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <span className={`text-[11px] font-black uppercase tracking-widest italic ${me.role === 'SABOTEUR' ? 'text-red-400' : 'text-orange-500'}`}>
                    {card.category}
                  </span>
                  <span className="font-black text-2xl leading-[1.1] pr-2 tracking-tighter">{card.name}</span>
                  {me.role === 'SABOTEUR' && <Skull size={20} className="absolute bottom-6 right-6 opacity-10" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {roomData.state === 'TASTE_TEST' && (
          <div className="flex-1 flex flex-col space-y-5 pt-4">
             <div className="bg-red-600 p-10 rounded-[3rem] text-white text-center shadow-2xl mb-6 border-b-[12px] border-red-800">
               <Skull size={56} className="mx-auto mb-4" />
               <h2 className="text-5xl font-black italic tracking-tighter leading-none mb-1">TERMINATE!</h2>
               <p className="font-black text-red-100 uppercase tracking-widest text-[10px]">Identify the contaminated cook</p>
             </div>
             <div className="space-y-4">
               {Object.values(roomData.players).filter(p => p.id !== auth.currentUser?.uid).map(p => (
                 <button 
                  key={p.id} 
                  onClick={() => handleVote(p.id)} 
                  disabled={!!roomData.votes?.[auth.currentUser?.uid]} 
                  className={`w-full p-8 rounded-[2rem] border-b-[10px] font-black text-3xl transition-all flex items-center justify-between tracking-tighter ${
                    roomData.votes?.[auth.currentUser?.uid] === p.id 
                      ? 'bg-red-500 border-red-700 text-white translate-y-2 shadow-none' 
                      : 'bg-white border-slate-200 text-slate-900 shadow-xl active:translate-y-2 active:shadow-none'
                  }`}
                 >
                   {p.name}
                   {roomData.votes?.[auth.currentUser?.uid] === p.id && <CheckCircle size={36} />}
                 </button>
               ))}
             </div>
             {roomData.votes?.[auth.currentUser?.uid] && (
               <div className="text-center font-black text-slate-400 uppercase tracking-widest text-xs mt-4 animate-pulse">
                 Investigation in progress...
               </div>
             )}
          </div>
        )}

        {(roomData.state === 'ROUND_END' || roomData.state === 'VOTE_REVEAL') && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-in zoom-in duration-500">
                 <div className="bg-white p-16 rounded-[4rem] shadow-2xl border-b-[16px] border-slate-100 w-full">
                    <div className="bg-slate-900 w-28 h-28 rounded-full flex items-center justify-center text-white mx-auto mb-10 shadow-2xl">
                      <RotateCcw size={56} className="animate-spin-slow" />
                    </div>
                    <h2 className="text-5xl font-black text-slate-950 tracking-tighter leading-none mb-4 uppercase">SHIFT OVER</h2>
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">Awaiting evaluation</p>
                 </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center gap-10">
        <div className="relative">
          <div className="absolute inset-0 bg-orange-500/20 blur-[60px] rounded-full animate-pulse" />
          <Flame size={100} className="text-orange-500 relative z-10 animate-bounce" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="h-3 w-64 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
             <div className="h-full bg-orange-500 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 italic">Prepping Station</span>
        </div>
      </div>
    </div>
  );
}