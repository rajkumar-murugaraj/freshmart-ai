'use client';

import React, { useEffect, useRef } from 'react';
import { Copy, MessageCircle, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { Product } from '../types';

interface ShareMenuProps {
  product: Product;
  onClose: () => void;
  position?: 'above' | 'below';
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ product, onClose, position = 'below' }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?product=${product.id}` : '';
  const shareText = `Check out ${product.name} at ₹${product.price}/${product.unit} on FreshMart!`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCopyLink = () => { navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); toast.success('Link copied to clipboard!'); onClose(); };
  const handleWhatsApp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, '_blank'); onClose(); };
  const handleFacebook = () => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400'); onClose(); };
  const handleTwitter = () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=400'); onClose(); };
  const handleInstagram = () => { navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); toast.info('Text copied! Paste it in your Instagram story or post.'); onClose(); };

  const positionClass = position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div ref={menuRef} className={`absolute right-0 ${positionClass} w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Share</span>
        <button onClick={onClose} className="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><X className="h-3.5 w-3.5" /></button>
      </div>
      <button onClick={handleWhatsApp} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <MessageCircle className="h-4 w-4 text-green-500" />WhatsApp
      </button>
      <button onClick={handleFacebook} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>Facebook
      </button>
      <button onClick={handleTwitter} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <svg className="h-4 w-4 text-gray-900 dark:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>X (Twitter)
      </button>
      <button onClick={handleInstagram} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <svg className="h-4 w-4 text-pink-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>Instagram
      </button>
      <div className="border-t border-gray-100 dark:border-gray-700">
        <button onClick={handleCopyLink} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Copy className="h-4 w-4 text-gray-500" />Copy Link
        </button>
      </div>
    </div>
  );
};
