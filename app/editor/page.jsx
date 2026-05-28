"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

// 🌟 卡牌專屬設定檔：在這裡填寫每張卡的正面圖片與專屬秒數
const CARD_CONFIG = [
  { id: 0, image: "/card1.jpg", initialTime: 30 },
  { id: 1, image: "/card2.jpg", initialTime: 10 },
  { id: 2, image: "/card3.jpg", initialTime: 15 },
  { id: 3, image: "/card4.jpg", initialTime: 20 },
  { id: 4, image: "/card5.jpg", initialTime: 25 },
  { id: 5, image: "/card6.jpg", initialTime: 30 },
  { id: 6, image: "/card7.jpg", initialTime: 35 },
  { id: 7, image: "/card8.jpg", initialTime: 40 },
  { id: 8, image: "/card9.jpg", initialTime: 45 },
];

export default function EditorPage() {
  const [cards, setCards] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const emojiChannelRef = useRef(null);

  const activeCard = cards.find(c => c.is_flipped && !c.is_disabled);
  const isAnyCardActive = !!activeCard;

  useEffect(() => {
    fetchCards();

    const cardChannel = supabase
      .channel('cards-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (payload) => {
        setCards((prev) => prev.map((card) => (card.id === payload.new.id ? payload.new : card)));
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
        
        setFloatingEmojis((prev) => [...prev, newEmoji]);

        setTimeout(() => {
          setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
        }, 6000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cardChannel);
      if (emojiChannelRef.current) supabase.removeChannel(emojiChannelRef.current);
    };
  }, []);

  const fetchCards = async () => {
    const { data } = await supabase.from('cards').select('*').order('id', { ascending: true });
    if (data) setCards(data);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCards((prevCards) => {
        return prevCards.map((card) => {
          if (card.is_flipped && !card.is_disabled && card.time_left > 0) {
            const nextTime = card.time_left - 1;
            if (nextTime === 0) {
              updateCardToDisappear(card.id);
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
    if (isAnyCardActive) return;

    const card = cards.find(c => c.id === id);
    if (card && !card.is_flipped && !card.is_disabled) {
      await supabase.from('cards').update({ is_flipped: true }).eq('id', id);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("確定要重置所有卡牌嗎？這會讓所有卡牌回到初始設定的秒數。")) return;
    
    // 根據 CARD_CONFIG 重新寫入每張卡牌專屬的 initialTime
    const resetPromises = cards.map((card) => {
      const config = CARD_CONFIG.find(c => c.id === card.id);
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

      {activeCard && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 pointer-events-auto">
          <div className="animate-zoomIn flex flex-col items-center">
            {/* 根據被點擊的卡片 ID，自動帶入對應的正面圖片 */}
            <img 
              src={CARD_CONFIG.find(c => c.id === activeCard.id)?.image} 
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
        <div className="grid grid-cols-3 gap-3 w-full aspect-[2/3] max-h-full">
          {cards.map((card) => (
            !card.is_disabled ? (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="w-full aspect-[2/3] rounded-lg cursor-pointer hover:-translate-y-1 transition-all duration-300 group"
              >
                <img 
                  src="/遊戲王卡背.png" 
                  alt="卡片背面" 
                  className="w-full h-full object-cover rounded-lg shadow-md group-hover:shadow-xl group-hover:border-2 group-hover:border-blue-400 transition-all" 
                />
              </div>
            ) : (
              <div key={card.id} className="w-full aspect-[2/3] opacity-0 pointer-events-none"></div>
            )
          ))}
        </div>
      </div>

      {floatingEmojis.map((item) => (
        <div key={item.id} className="animate-float text-5xl" style={{ left: `${item.left}%` }}>
          {item.emoji}
        </div>
      ))}
    </div>
  );
}