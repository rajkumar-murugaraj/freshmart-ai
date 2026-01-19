import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  isAdmin: boolean;
  onAddToCart?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isAdmin,
  onAddToCart,
  onEdit,
  onDelete
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
      <div className="relative h-48 w-full bg-gray-100 overflow-hidden group">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
        />
        {product.category && (
          <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-green-700 text-xs font-semibold px-2 py-1 rounded">
            {product.category}
          </span>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-gray-800">{product.name}</h3>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2 flex-grow">{product.description}</p>
        
        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">₹{product.price}</span>
            <span className="text-sm text-gray-500 ml-1">/{product.unit}</span>
          </div>
        </div>

        <div className="mt-4">
          {isAdmin ? (
            <div className="flex space-x-2">
              <button 
                onClick={() => onEdit?.(product)}
                className="flex-1 flex items-center justify-center space-x-1 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </button>
              <button 
                onClick={() => onDelete?.(product.id)}
                className="flex-1 flex items-center justify-center space-x-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => onAddToCart?.(product)}
              className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium active:scale-95 transform"
            >
              <Plus className="h-5 w-5" />
              <span>Add to Cart</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};