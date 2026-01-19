import React, { useState } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles } from 'lucide-react';
import { getRecipeSuggestion } from '../services/geminiService';
import { CartItem } from '../types';

interface AIAssistantProps {
  cart: CartItem[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ cart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: "Hi! I'm your FreshMart Chef. I can suggest recipes based on your cart!" }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAskRecipe = async () => {
    if (cart.length === 0) {
      setMessages(prev => [...prev, { role: 'user', text: "Suggest a recipe." }]);
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: "Your cart is empty! Add some veggies or fruits first." }]);
      }, 500);
      return;
    }

    const userMsg = "Suggest a recipe based on my cart.";
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const ingredients = cart.map(item => item.name);
    const response = await getRecipeSuggestion(ingredients);

    setMessages(prev => [...prev, { role: 'ai', text: response }]);
    setIsLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 z-40 flex items-center space-x-2"
      >
        <Sparkles className="h-6 w-6" />
        <span className="font-semibold hidden sm:inline">AI Chef</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col max-h-[500px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center space-x-2">
          <Bot className="h-6 w-6" />
          <h3 className="font-bold">FreshMart AI Chef</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 rounded-full p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 h-80">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex space-x-1 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button 
          onClick={handleAskRecipe}
          disabled={isLoading}
          className="w-full bg-blue-50 text-blue-600 font-medium py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          <span>Suggest Recipe from Cart</span>
        </button>
      </div>
    </div>
  );
};