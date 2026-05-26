"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

// 🌟 卡牌專屬設定檔：請與 Editor 保持一致，填寫每張卡的正面圖片
const CARD_CONFIG = [
  { id: 0, image: "/M字閒聊1.jpg" },
  { id: 1, image: "" },
  { id: 2, image: "" },
  { id: 3, image: "" },
  { id: 4, image: "" },
  { id: 5, image: "" },
  { id: 6, image: "" },
  { id: 7, image: "" },
  { id: 8, image: "" },
];

export default function ViewerPage() {
  const [cards, setCards] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const emojiChannelRef = useRef(null);

  const activeCard = cards.find(c => c.is_flipped && !c.is_disabled);

  useEffect(() => {
    fetchCards();

    const cardChannel = supabase
      .channel('cards-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (payload) => {
        setCards((prev) => prev.map((card) => (card.id === payload.new.id ? payload.new : card)));
      })
      .subscribe();

    emojiChannelRef.current = supabase.channel('emoji-room');
    emojiChannelRef.current.subscribe();

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
            return { ...card, time_left: card.time_left - 1 };
          }
          return card;
        });
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEmojiSend = (emoji) => {
    if (emojiChannelRef.current) {
      emojiChannelRef.current.send({
        type: 'broadcast',
        event: 'send-emoji',
        payload: { emoji },
      });
    }

    const newEmoji = {
      id: Math.random(),
      emoji: emoji,
      left: Math.floor(Math.random() * 80) + 10,
    };
    
    setFloatingEmojis((prev) => [...prev, newEmoji]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 6000);
  };

  return (
    <div className="h-screen bg-gray-900 p-4 pb-24 flex flex-col items-center relative overflow-hidden">
      <h1 className="text-gray-400 text-xs mb-4 font-bold tracking-widest z-10">VIEWER MODE</h1>
      
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
        @keyframes zoomInCenterViewer {
          0% { transform: translate(-50%, 100%) scale(0.1); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .animate-zoomInViewer {
          animation: zoomInCenterViewer 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          position: fixed;
          top: 50%;
          left: 50%;
          z-index: 60;
        }
      `}</style>

      {activeCard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="animate-zoomInViewer flex flex-col items-center">
            {/* 根據被點擊的卡片 ID，自動帶入對應的正面圖片 */}
            <img 
              src={CARD_CONFIG[activeCard.id]?.image} 
              alt="卡片正面" 
              className="h-[60vh] aspect-[2/3] object-contain shadow-2xl rounded-md" 
            />
            <div className="mt-6 text-white text-3xl font-black bg-blue-600 px-6 py-2 rounded-full shadow-md animate-pulse">
              ⏱️ {activeCard.time_left} 秒
            </div>
          </div>
        </div>
      )}

      <div className={`flex-grow w-full max-w-md flex items-center justify-center min-h-0 z-10 transition-opacity duration-300 ${activeCard ? "opacity-20" : "opacity-100"}`}>
        <div className="grid grid-cols-3 gap-3 w-full aspect-[2/3] max-h-full">
          {cards.map((card) => (
            !card.is_disabled ? (
              <div key={card.id} className="w-full aspect-[2/3] rounded-sm bg-gray-800">
                <img src="/遊戲王卡背.png" alt="卡片背面" className="w-full h-full object-cover rounded-sm shadow-sm" />
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

      <div className="fixed bottom-0 left-0 w-full bg-gray-800/90 backdrop-blur-sm p-4 flex justify-around items-center border-t border-gray-700 z-[80] pointer-events-auto">
        {['👍', '😍', '😂', '😮', '❓'].map((emoji) => (
          <button 
            key={emoji} 
            onClick={() => handleEmojiSend(emoji)} 
            className="text-4xl active:scale-75 hover:-translate-y-1 transition-transform duration-150"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}