'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Bot, Sparkles, Send, ChefHat, Utensils, Apple, Leaf, RefreshCw, ShoppingCart, Loader2 } from 'lucide-react';
import { CartItem } from '../types';
import { api } from '../lib/api';

interface AIAssistantProps {
  cart: CartItem[];
}

type MessageRole = 'user' | 'ai';

interface Message {
  role: MessageRole;
  text: string;
  type?: 'recipe' | 'nutrition' | 'meal-plan' | 'substitute' | 'tip' | 'general';
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  action: string;
  color: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ cart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: "Hi! I'm your FreshMart AI Chef! I can help you with:\n\n- Recipe suggestions from your cart\n- Meal planning for the week\n- Nutrition information\n- Ingredient substitutions\n- Cooking tips & tricks\n\nHow can I help you today?",
      type: 'general'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const quickActions: QuickAction[] = [
    { icon: <ChefHat className="h-4 w-4" />, label: 'Recipe', action: 'recipe', color: 'bg-orange-100 text-orange-600 hover:bg-orange-200' },
    { icon: <Utensils className="h-4 w-4" />, label: 'Meal Plan', action: 'meal-plan', color: 'bg-blue-100 text-blue-600 hover:bg-blue-200' },
    { icon: <Apple className="h-4 w-4" />, label: 'Nutrition', action: 'nutrition', color: 'bg-green-100 text-green-600 hover:bg-green-200' },
    { icon: <RefreshCw className="h-4 w-4" />, label: 'Substitutes', action: 'substitute', color: 'bg-purple-100 text-purple-600 hover:bg-purple-200' },
    { icon: <Leaf className="h-4 w-4" />, label: 'Tips', action: 'tips', color: 'bg-teal-100 text-teal-600 hover:bg-teal-200' },
  ];

  const handleQuickAction = async (action: string) => {
    const cartItems = cart.map(item => item.name);

    let userMessage = '';

    switch (action) {
      case 'recipe':
        if (cart.length === 0) {
          setMessages(prev => [...prev,
            { role: 'user', text: 'Suggest a recipe from my cart' },
            { role: 'ai', text: 'Your cart is empty! Add some ingredients first, and I\'ll suggest delicious recipes you can make with them.', type: 'general' }
          ]);
          return;
        }
        userMessage = 'Suggest a recipe from my cart';
        break;
      case 'meal-plan':
        userMessage = cart.length > 0
          ? 'Create a weekly meal plan using my cart items'
          : 'Create a healthy weekly meal plan for me';
        break;
      case 'nutrition':
        if (cart.length === 0) {
          setMessages(prev => [...prev,
            { role: 'user', text: 'Show nutrition info for my cart' },
            { role: 'ai', text: 'Your cart is empty! Add some items to see their nutritional information.', type: 'general' }
          ]);
          return;
        }
        userMessage = 'Show nutrition info for my cart items';
        break;
      case 'substitute':
        if (cart.length === 0) {
          setMessages(prev => [...prev,
            { role: 'user', text: 'Suggest ingredient substitutes' },
            { role: 'ai', text: 'Your cart is empty! Add some items and I\'ll suggest healthy substitutes for them.', type: 'general' }
          ]);
          return;
        }
        userMessage = 'Suggest healthy substitutes for my cart items';
        break;
      case 'tips':
        userMessage = 'Give me useful cooking tips';
        break;
      default:
        return;
    }

    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await api.askAIChef(userMessage, cartItems);
      setMessages(prev => [...prev, { role: 'ai', text: response, type: action as Message['type'] }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Sorry, I encountered an issue. Please try again!',
        type: 'general'
      }]);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const cartItems = cart.map(item => item.name);
      const response = await api.askAIChef(userMessage, cartItems);
      setMessages(prev => [...prev, { role: 'ai', text: response, type: 'general' }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Sorry, I had trouble processing your request. Please try again!',
        type: 'general'
      }]);
    }
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'ai',
      text: "Chat cleared! I'm ready to help you again. What would you like to know?",
      type: 'general'
    }]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 z-40 flex items-center space-x-2 group"
      >
        <Sparkles className="h-6 w-6 group-hover:animate-pulse" />
        <span className="font-semibold hidden sm:inline">AI Chef</span>
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {cart.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[360px] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-full">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">FreshMart AI Chef</h3>
            <p className="text-xs text-white/80">Your personal cooking assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
            title="Clear chat"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 border-b border-green-100 flex items-center space-x-2">
          <ShoppingCart className="h-4 w-4 text-green-600" />
          <span className="text-xs text-green-700 font-medium">
            {cart.length} item{cart.length > 1 ? 's' : ''} in cart: {cart.slice(0, 3).map(i => i.name).join(', ')}{cart.length > 3 ? '...' : ''}
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-1.5">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickAction(action.action)}
            disabled={isLoading}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${action.color} disabled:opacity-50`}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-[280px]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              <span className="text-sm text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about cooking..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Powered by Google Gemini AI
        </p>
      </div>
    </div>
  );
};
