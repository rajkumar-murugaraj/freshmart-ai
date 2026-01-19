'use client';

import React from 'react';
import { X, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { CartItem } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (id: string, change: number) => void;
  onCheckout: () => void;
  onAskAI: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onCheckout,
  onAskAI
}) => {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
        <div className="w-full h-full bg-white shadow-2xl flex flex-col animate-slideIn">

          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="h-6 w-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Your Cart</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-gray-50 p-6 rounded-full">
                  <ShoppingBag className="h-12 w-12 text-gray-300" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900">Your cart is empty</p>
                  <p className="text-gray-500">Looks like you haven&apos;t added anything yet.</p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-4 text-green-600 font-medium hover:text-green-700"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-16 w-16 rounded-md object-cover bg-white"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">₹{item.price} / {item.unit}</p>
                    </div>
                    <div className="flex items-center space-x-3 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-200">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="p-1 hover:text-red-500 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="p-1 hover:text-green-500 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="bg-blue-50 rounded-lg p-4 mt-6">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">Need ideas?</h4>
                  <p className="text-xs text-blue-600 mb-3">Ask our AI Chef what to cook with these ingredients!</p>
                  <button
                    onClick={onAskAI}
                    className="w-full bg-white text-blue-600 border border-blue-200 py-2 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
                  >
                    Suggest a Recipe
                  </button>
                </div>
              </>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t border-gray-100 p-6 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-2xl font-bold text-gray-900">₹{total}</span>
              </div>
              <button
                onClick={onCheckout}
                className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3.5 rounded-xl hover:bg-green-700 font-bold text-lg shadow-lg shadow-green-200 transition-all transform active:scale-95"
              >
                <span>Checkout Now</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
