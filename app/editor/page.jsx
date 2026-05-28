"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

const CARD_CONFIG = [
  { id: 0, image: "/card1.jpg", initialTime: 30 },
  { id: 1, image: "/card2.jpg", initialTime: 45 },
  { id: 2, image: "/card3.jpg", initialTime: 15 },
  { id: 3, image: "/card4.jpg", initialTime: 30 },
  { id: 4, image: "/card5.jpg", initialTime: 60 },
  { id: 5, image: "/card6.jpg", initialTime: 30 },
  { id: 6, image: "/card7.jpg", initialTime: 30 },
  { id: 7, image: "/card8.jpg", initialTime: 30 },
  { id: 8, image: "/card9.jpg", initialTime: 45 },
];

export default function EditorPage() {
  const [cards, setCards] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const emojiChannelRef = useRef(null);

  const activeCard = cards.find(c => c.is_flipped && !c.is_disabled);
  const isAnyCardActive = !!activeCard;
  
  const isAllCardsDisabled = cards.length > 0 && cards.every(c => c.is_disabled);

  const playSound = (type) => {
    try {
      const audio = new Audio(type === 'flip' ? '/flip.mp3' : '/disappear.mp3');
      audio.play().catch(e => console.log("瀏覽器阻擋音效", e));
    } catch (error) {}
  };

  useEffect(() => {
    fetchCards();
    fetchGameStatus();

    const dbChannel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (payload) => {
        setCards((prev) => prev.map((card) => (card.id === payload.new.id ? payload.new : card)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_status' }, (payload) => {
        if (payload.new.id === 1) setGameStarted(payload.new.is_started);
      })
      .subscribe();

    emojiChannelRef.current = supabase.channel('emoji-room');
    emojiChannelRef.current
      .on('broadcast', { event: 'send-emoji' }, (payload) => {
        const newEmoji = {
          id: Math.random(),
          emoji: payload.payload.emoji,
          left: Math.floor(Math.random() * 80) + 10,
        };
        
        setFloatingEmojis((prev) => {
          const next = [...prev, newEmoji];
          if (next.length > 40) return next.slice(next.length - 40);
          return next;
        });

        setTimeout(() => {
          setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
        }, 6000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      if (emojiChannelRef.current) supabase.removeChannel(emojiChannelRef.current);
    };
  }, []);

  const fetchCards = async () => {
    const { data } = await supabase.from('cards').select('*').order('id', { ascending: true });
    if (data) setCards(data);
  };

  const fetchGameStatus = async () => {
    const { data } = await supabase.from('game_status').select('*').eq('id', 1).single();
    if (data) setGameStarted(data.is_started);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCards((prevCards) => {
        return prevCards.map((card) => {
          if (card.is_flipped && !card.is_disabled && card.time_left > 0) {
            const nextTime = card.time_left - 1;
            if (nextTime === 0) {
              updateCardToDisappear(card.id);
              playSound('disappear');
              return { ...card, time_left: 0, is_flipped: false, is_disabled: true };
            }
            return { ...card, time_left: nextTime };
          }
          return card;
        });
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const updateCardToDisappear = async (id) => {
    await supabase.from('cards').update({ is_flipped: false, is_disabled: true }).eq('id', id);
  };

  const handleCardClick = async (id) => {
    if (isAnyCardActive || !gameStarted) return;

    const card = cards.find(c => c.id === id);
    if (card && !card.is_flipped && !card.is_disabled) {
      playSound('flip');
      await supabase.from('cards').update({ is_flipped: true }).eq('id', id);
    }
  };

  const handleStartGame = async () => {
    await supabase.from('game_status').update({ is_started: true }).eq('id', 1);
  };

  const handleResetAll = async () => {
    if (!confirm("確定要重置所有卡牌並回到待機畫面嗎？")) return;
    
    await supabase.from('game_status').update({ is_started: false }).eq('id', 1);

    const resetPromises = cards.map((card) => {
      const config = CARD_CONFIG.find(c => String(c.id) === String(card.id));
      return supabase
        .from('cards')
        .update({
          is_flipped: false,
          is_disabled: false,
          time_left: config ? config.initialTime : 10
        })
        .eq('id', card.id);
    });
    
    await Promise.all(resetPromises);
    fetchCards();
  };

  return (
    <div className="h-screen bg-gray-900 p-4 flex flex-col items-center relative overflow-hidden">
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(10vh) scale(0.5); opacity: 0; }
          10% { transform: translateY(0vh) scale(1.2); opacity: 1; }
          20% { transform: translateY(-20vh) scale(1); opacity: 1; }
          90% { transform: translateY(-90vh) scale(1); opacity: 1; }
          100% { transform: translateY(-110vh) scale(1); opacity: 0; }
        }
        .animate-float {
          animation: floatUp 6s linear forwards;
          position: absolute;
          bottom: 0;
          pointer-events: none;
          z-index: 70;
        }
        @keyframes zoomInCenter {
          0% { transform: translate(-50%, 100%) scale(0.1); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .animate-zoomIn {
          animation: zoomInCenter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          position: fixed;
          top: 50%;
          left: 50%;
          z-index: 60;
        }
      `}</style>

      {!gameStarted && (
        <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-[80]">
          <h1 className="text-white text-4xl font-bold mb-8 tracking-widest">控制台待機中</h1>
          <button 
            onClick={handleStartGame}
            className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-full font-bold text-2xl transition-all shadow-lg hover:scale-105"
          >
            ▶ 遊戲開始
          </button>
        </div>
      )}

      {activeCard && gameStarted && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 pointer-events-auto">
          <div className="animate-zoomIn flex flex-col items-center">
            <img 
              src={CARD_CONFIG.find(c => String(c.id) === String(activeCard.id))?.image} 
              alt="卡片正面" 
              className="h-[70vh] aspect-[2/3] object-contain shadow-2xl rounded-md" 
            />
            <div className="mt-6 text-white text-4xl font-black bg-amber-600 px-8 py-3 rounded-full shadow-lg animate-pulse">
              ⏱️ {activeCard.time_left} 秒
            </div>
          </div>
        </div>
      )}

      <header className={`flex items-center gap-6 mb-4 z-10 w-full max-w-md justify-between transition-opacity duration-300 ${isAnyCardActive ? "opacity-20" : "opacity-100"}`}>
        <h1 className="text-white text-lg font-bold tracking-wider">控制台</h1>
        <button 
          onClick={handleResetAll}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-md"
          disabled={isAnyCardActive}
        >
          🔄 重置
        </button>
      </header>
      
      <div className={`flex-grow w-full max-w-md flex items-center justify-center min-h-0 z-10 transition-opacity duration-300 ${isAnyCardActive ? "opacity-20 pointer-events-none" : "opacity-100"}`}>
        {isAllCardsDisabled && gameStarted ? (
          <div className="text-center bg-gray-800/80 p-8 rounded-xl border border-gray-700 shadow-2xl">
            <p className="text-white text-2xl font-bold tracking-wider leading-relaxed">
              卡牌已全數發動<br />暫無可使用卡牌
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 w-full aspect-[2/3] max-h-full">
            {cards.map((card) => (
              !card.is_disabled ? (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className="w-full aspect-[2/3] rounded-lg cursor-pointer hover:-translate-y-1 transition-all duration-300 group"
                >
                  <img src="/遊戲王卡背.png" alt="卡片背面" className="w-full h-full object-cover rounded-lg shadow-md group-hover:shadow-xl group-hover:border-2 group-hover:border-blue-400 transition-all" />
                </div>
              ) : (
                <div key={card.id} className="w-full aspect-[2/3] opacity-0 pointer-events-none"></div>
              )
            ))}
          </div>
        )}
      </div>

      {floatingEmojis.map((item) => (
        <div key={item.id} className="animate-float text-5xl" style={{ left: `${item.left}%` }}>{item.emoji}</div>
      ))}
    </div>
  );
}