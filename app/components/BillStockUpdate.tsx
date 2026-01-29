'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  Check,
  AlertTriangle,
  Package,
  RefreshCw,
  FileText,
  Edit3,
  Plus,
  Search,
  Cpu
} from 'lucide-react';
import { api } from '../lib/api';
import { User, Product } from '../types';
import Tesseract from 'tesseract.js';

interface ScannedItem {
  billName: string;
  matchedProduct: string | null;
  quantity: number;
  unit: string;
  price: number | null;
  confidence: string;
  product: {
    id: string;
    name: string;
    currentStock: number;
    unit: string;
    price: number;
    cost_price: number;
  } | null;
  isMatched: boolean;
}

interface BillInfo {
  vendor: string | null;
  date: string | null;
  total: number | null;
  billNumber: string | null;
}

interface BillStockUpdateProps {
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

// Parse OCR text to extract bill items
function parseBillText(text: string, products: Product[]): { items: ScannedItem[], billInfo: BillInfo } {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items: ScannedItem[] = [];

  // Extract bill info
  const billInfo: BillInfo = {
    vendor: null,
    date: null,
    total: null,
    billNumber: null
  };

  // Common patterns for bill info
  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
  const totalPattern = /(?:total|grand\s*total|amount|net)[:\s]*(?:rs\.?|₹)?\s*(\d+(?:[.,]\d+)?)/i;
  const billNoPattern = /(?:bill|invoice|receipt)\s*(?:no\.?|#|number)[:\s]*([A-Z0-9\-]+)/i;

  for (const line of lines) {
    // Try to extract date
    const dateMatch = line.match(datePattern);
    if (dateMatch && !billInfo.date) {
      billInfo.date = dateMatch[1];
    }

    // Try to extract total
    const totalMatch = line.match(totalPattern);
    if (totalMatch) {
      billInfo.total = parseFloat(totalMatch[1].replace(',', ''));
    }

    // Try to extract bill number
    const billNoMatch = line.match(billNoPattern);
    if (billNoMatch) {
      billInfo.billNumber = billNoMatch[1];
    }
  }

  // First line is often vendor name
  if (lines.length > 0 && !lines[0].match(/\d{5,}/)) {
    billInfo.vendor = lines[0].substring(0, 50);
  }

  // Patterns for product lines with quantities
  // Common formats: "Product Name    2    50.00" or "2 x Product Name @ 25"
  const productPatterns = [
    // "Product Name    qty    price" format
    /^(.+?)\s{2,}(\d+(?:\.\d+)?)\s*(?:kg|g|pcs?|pieces?|packs?|ltrs?|l|ml)?\s*(?:@|x|×)?\s*[\d.,]+$/i,
    // "qty x Product Name" format
    /^(\d+(?:\.\d+)?)\s*(?:x|×|nos?\.?)\s+(.+?)(?:\s+[@₹]?\s*[\d.,]+)?$/i,
    // "Product Name qty" simple format
    /^([A-Za-z].+?)\s+(\d+(?:\.\d+)?)\s*(?:kg|g|pcs?|pieces?|packs?|ltrs?|l|ml)?$/i,
    // Line with product-like words
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*$/
  ];

  for (const line of lines) {
    // Skip header/footer lines
    if (line.match(/^(total|sub\s*total|grand|amount|gst|tax|discount|cash|card|upi|balance|change|thank|welcome|phone|address|gstin)/i)) {
      continue;
    }

    let productName: string | null = null;
    let quantity: number | null = null;

    // Try each pattern
    for (const pattern of productPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Different patterns have name/qty in different positions
        if (pattern.source.startsWith('^(\\d')) {
          // Qty first pattern
          quantity = parseFloat(match[1]);
          productName = match[2].trim();
        } else {
          productName = match[1].trim();
          quantity = parseFloat(match[2]);
        }
        break;
      }
    }

    // If we found something that looks like a product
    if (productName && productName.length > 2) {
      // Try to match with existing products
      let matchedProduct: Product | null = null;
      let confidence = 'low';

      const nameLower = productName.toLowerCase();

      // Exact match
      matchedProduct = products.find(p => p.name.toLowerCase() === nameLower) || null;
      if (matchedProduct) {
        confidence = 'high';
      }

      // Partial match
      if (!matchedProduct) {
        matchedProduct = products.find(p =>
          p.name.toLowerCase().includes(nameLower) ||
          nameLower.includes(p.name.toLowerCase())
        ) || null;
        if (matchedProduct) {
          confidence = 'medium';
        }
      }

      // Word-based matching
      if (!matchedProduct) {
        const words = nameLower.split(/\s+/).filter(w => w.length > 2);
        for (const word of words) {
          matchedProduct = products.find(p =>
            p.name.toLowerCase().includes(word)
          ) || null;
          if (matchedProduct) {
            confidence = 'low';
            break;
          }
        }
      }

      items.push({
        billName: productName,
        matchedProduct: matchedProduct?.name || null,
        quantity: quantity || 1,
        unit: matchedProduct?.unit || 'pcs',
        price: null,
        confidence,
        product: matchedProduct ? {
          id: matchedProduct.id,
          name: matchedProduct.name,
          currentStock: matchedProduct.stock ?? 0,
          unit: matchedProduct.unit,
          price: matchedProduct.price,
          cost_price: matchedProduct.cost_price || 0
        } : null,
        isMatched: !!matchedProduct
      });
    }
  }

  return { items, billInfo };
}

export const BillStockUpdate: React.FC<BillStockUpdateProps> = ({
  currentUser,
  onClose,
  onSuccess
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [billInfo, setBillInfo] = useState<BillInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'review' | 'success'>('upload');
  const [updateResults, setUpdateResults] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ocrText, setOcrText] = useState<string>('');

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };
    fetchProducts();
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleScanBill = async () => {
    if (!imageFile || !imagePreview) return;

    setScanning(true);
    setScanProgress(0);
    setError(null);

    try {
      // Use Tesseract.js for OCR
      const result = await Tesseract.recognize(
        imagePreview,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setScanProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const extractedText = result.data.text;
      setOcrText(extractedText);

      // Parse the OCR text to extract items
      const parsed = parseBillText(extractedText, products);
      setScannedItems(parsed.items);
      setBillInfo(parsed.billInfo);

      // Auto-select all matched items
      const matchedIndexes = new Set<number>();
      parsed.items.forEach((item: ScannedItem, index: number) => {
        if (item.isMatched) {
          matchedIndexes.add(index);
        }
      });
      setSelectedItems(matchedIndexes);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to scan bill');
    }

    setScanning(false);
    setScanProgress(0);
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const startEditQuantity = (index: number) => {
    setEditingIndex(index);
    setEditQuantity(String(scannedItems[index].quantity));
  };

  const saveEditQuantity = () => {
    if (editingIndex === null) return;

    const qty = parseInt(editQuantity) || 0;
    if (qty > 0) {
      const newItems = [...scannedItems];
      newItems[editingIndex] = { ...newItems[editingIndex], quantity: qty };
      setScannedItems(newItems);
    }
    setEditingIndex(null);
    setEditQuantity('');
  };

  const handleApplyUpdates = async () => {
    const itemsToUpdate = scannedItems
      .filter((_, index) => selectedItems.has(index))
      .filter(item => item.isMatched && item.product)
      .map(item => ({
        productId: item.product!.id,
        productName: item.product!.name,
        quantity: item.quantity
      }));

    if (itemsToUpdate.length === 0) {
      setError('No items selected for update');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const result = await api.applyBillStockUpdate(
        itemsToUpdate,
        currentUser.id,
        billInfo
      );
      setUpdateResults(result.results || []);
      setStep('success');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update stock');
    }

    setUpdating(false);
  };

  const resetAll = () => {
    setImageFile(null);
    setImagePreview(null);
    setScannedItems([]);
    setBillInfo(null);
    setSelectedItems(new Set());
    setStep('upload');
    setUpdateResults([]);
    setError(null);
    setOcrText('');
    setScanProgress(0);
  };

  const matchedCount = scannedItems.filter(i => i.isMatched).length;
  const selectedCount = Array.from(selectedItems).filter(i => scannedItems[i]?.isMatched).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-green-600" />
              Update Stock from Bill
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload purchase bill to auto-update inventory</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  imagePreview
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                }`}
              >
                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt="Bill preview"
                      className="max-h-48 mx-auto rounded-lg shadow-md"
                    />
                    <p className="text-sm text-gray-600">{imageFile?.name}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="text-red-600 text-sm hover:text-red-800"
                    >
                      Remove and choose another
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-700 font-medium">Drop bill image here or click to upload</p>
                      <p className="text-gray-500 text-sm mt-1">Supports JPG, PNG, WEBP</p>
                    </div>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {/* Tips */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Cpu className="h-4 w-4 mr-2 text-blue-600" />
                  <h4 className="font-medium text-blue-800 text-sm">Local OCR Processing</h4>
                </div>
                <p className="text-xs text-blue-600 mb-2">No internet or API required - runs entirely in your browser!</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Ensure the bill is clearly visible and well-lit</li>
                  <li>• Product names and quantities should be readable</li>
                  <li>• Works best with printed bills/invoices</li>
                  <li>• First scan may take longer to load OCR engine</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Bill Info */}
              {billInfo && (billInfo.vendor || billInfo.date || billInfo.billNumber) && (
                <div className="bg-gray-50 p-3 rounded-lg text-sm">
                  <div className="flex flex-wrap gap-4">
                    {billInfo.vendor && (
                      <div>
                        <span className="text-gray-500">Vendor:</span>
                        <span className="ml-1 font-medium">{billInfo.vendor}</span>
                      </div>
                    )}
                    {billInfo.billNumber && (
                      <div>
                        <span className="text-gray-500">Bill #:</span>
                        <span className="ml-1 font-medium">{billInfo.billNumber}</span>
                      </div>
                    )}
                    {billInfo.date && (
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <span className="ml-1 font-medium">{billInfo.date}</span>
                      </div>
                    )}
                    {billInfo.total && (
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-1 font-medium">₹{billInfo.total}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Found <span className="font-semibold">{scannedItems.length}</span> items,
                  <span className="font-semibold text-green-600"> {matchedCount}</span> matched
                </span>
                <span className="text-gray-500">
                  {selectedCount} selected for update
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {scannedItems.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-colors ${
                      !item.isMatched
                        ? 'border-orange-200 bg-orange-50'
                        : selectedItems.has(index)
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {item.isMatched && (
                          <button
                            onClick={() => toggleItemSelection(index)}
                            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedItems.has(index)
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {selectedItems.has(index) && <Check className="h-3 w-3" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 text-sm">{item.billName}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              item.confidence === 'high'
                                ? 'bg-green-100 text-green-700'
                                : item.confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.confidence}
                            </span>
                          </div>
                          {item.isMatched && item.product ? (
                            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                              <p className="flex items-center">
                                <Package className="h-3 w-3 mr-1" />
                                Matched: <span className="font-medium text-green-600 ml-1">{item.product.name}</span>
                              </p>
                              <p>Current Stock: {item.product.currentStock} {item.product.unit}</p>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-orange-600 flex items-center">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              No matching product found
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right ml-3">
                        {editingIndex === index ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 px-2 py-1 border rounded text-sm text-center"
                              autoFocus
                            />
                            <button
                              onClick={saveEditQuantity}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <div>
                              <p className="font-bold text-gray-900">+{item.quantity}</p>
                              <p className="text-xs text-gray-500">{item.unit}</p>
                            </div>
                            {item.isMatched && (
                              <button
                                onClick={() => startEditQuantity(index)}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* New stock preview */}
                    {item.isMatched && item.product && selectedItems.has(index) && (
                      <div className="mt-2 pt-2 border-t border-green-200 text-xs">
                        <span className="text-gray-500">After update:</span>
                        <span className="ml-1 font-semibold text-green-700">
                          {item.product.currentStock + item.quantity} {item.product.unit}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* OCR Text Viewer */}
              {ocrText && (
                <details className="bg-gray-50 rounded-lg">
                  <summary className="px-3 py-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900 flex items-center">
                    <Cpu className="h-3.5 w-3.5 mr-1.5" />
                    View extracted text (OCR)
                  </summary>
                  <div className="p-3 pt-0">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border max-h-32 overflow-y-auto">
                      {ocrText}
                    </pre>
                  </div>
                </details>
              )}

              {/* Preview Image Toggle */}
              {imagePreview && (
                <details className="bg-gray-50 rounded-lg">
                  <summary className="px-3 py-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                    View scanned bill image
                  </summary>
                  <div className="p-3 pt-0">
                    <img
                      src={imagePreview}
                      alt="Bill"
                      className="max-h-40 mx-auto rounded-lg"
                    />
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Stock Updated Successfully!</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {updateResults.filter(r => r.success).length} products updated
                </p>
              </div>

              {/* Results List */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {updateResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      result.success
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {result.success ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium text-sm">{result.productName}</span>
                      </div>
                      {result.success && (
                        <span className="text-sm text-gray-600">
                          {result.previousStock} → <span className="font-bold text-green-600">{result.newStock}</span>
                        </span>
                      )}
                    </div>
                    {!result.success && (
                      <p className="text-xs text-red-600 mt-1 ml-6">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex space-x-3 flex-shrink-0">
          {step === 'upload' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleScanBill}
                disabled={!imageFile || scanning}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm flex items-center justify-center"
              >
                {scanning ? (
                  <>
                    <Cpu className="h-4 w-4 mr-2 animate-pulse" />
                    Scanning... {scanProgress}%
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scan Bill (Local OCR)
                  </>
                )}
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={resetAll}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Start Over
              </button>
              <button
                onClick={handleApplyUpdates}
                disabled={selectedCount === 0 || updating}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm flex items-center justify-center"
              >
                {updating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Update {selectedCount} Products
                  </>
                )}
              </button>
            </>
          )}

          {step === 'success' && (
            <>
              <button
                onClick={resetAll}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Scan Another Bill
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
