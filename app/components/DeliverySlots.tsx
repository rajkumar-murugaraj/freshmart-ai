'use client';

import React, { useState, useMemo } from 'react';
import { Clock, Calendar, Zap } from 'lucide-react';

export interface DeliverySlot {
  id: string;
  date: string;
  displayDate: string;
  dayName: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  isExpress: boolean;
  available: boolean;
  price: number;
}

interface DeliverySlotsProps {
  selectedSlot: DeliverySlot | null;
  onSelectSlot: (slot: DeliverySlot) => void;
}

export const DeliverySlots: React.FC<DeliverySlotsProps> = ({
  selectedSlot,
  onSelectSlot
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Generate delivery slots for the next 7 days
  const deliveryData = useMemo(() => {
    const dates: { date: string; displayDate: string; dayName: string; isToday: boolean }[] = [];
    const slots: DeliverySlot[] = [];

    const timeSlots = [
      { start: '07:00', end: '09:00', label: '7 AM - 9 AM', isExpress: false },
      { start: '09:00', end: '11:00', label: '9 AM - 11 AM', isExpress: false },
      { start: '11:00', end: '13:00', label: '11 AM - 1 PM', isExpress: false },
      { start: '14:00', end: '16:00', label: '2 PM - 4 PM', isExpress: false },
      { start: '16:00', end: '18:00', label: '4 PM - 6 PM', isExpress: false },
      { start: '18:00', end: '20:00', label: '6 PM - 8 PM', isExpress: false },
      { start: '20:00', end: '22:00', label: '8 PM - 10 PM', isExpress: false },
    ];

    const now = new Date();
    const currentHour = now.getHours();

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      const dateStr = date.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const isToday = i === 0;
      const displayDate = isToday ? 'Today' : i === 1 ? 'Tomorrow' : `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;

      dates.push({
        date: dateStr,
        displayDate,
        dayName: dayNames[date.getDay()],
        isToday
      });

      // Add express delivery for today (if before 6 PM)
      if (isToday && currentHour < 18) {
        slots.push({
          id: `${dateStr}-express`,
          date: dateStr,
          displayDate,
          dayName: dayNames[date.getDay()],
          timeSlot: 'Express (1-2 hours)',
          startTime: 'now',
          endTime: '+2h',
          isExpress: true,
          available: true,
          price: 49
        });
      }

      // Add regular time slots
      timeSlots.forEach((ts, idx) => {
        const startHour = parseInt(ts.start.split(':')[0]);

        // For today, only show future time slots
        const isAvailable = isToday
          ? startHour > currentHour + 2
          : true;

        // Randomly make some slots unavailable for realism
        const randomAvailable = Math.random() > 0.1;

        slots.push({
          id: `${dateStr}-${idx}`,
          date: dateStr,
          displayDate,
          dayName: dayNames[date.getDay()],
          timeSlot: ts.label,
          startTime: ts.start,
          endTime: ts.end,
          isExpress: false,
          available: isAvailable && randomAvailable,
          price: 0
        });
      });
    }

    // Set first date as selected by default
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(dates[0].date);
    }

    return { dates, slots };
  }, []);

  const filteredSlots = deliveryData.slots.filter(slot => slot.date === (selectedDate || deliveryData.dates[0]?.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
        <Calendar className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold">Choose Delivery Slot</h3>
      </div>

      {/* Date Selection */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {deliveryData.dates.map((d) => (
          <button
            key={d.date}
            onClick={() => setSelectedDate(d.date)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all ${
              (selectedDate || deliveryData.dates[0]?.date) === d.date
                ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-600'
            }`}
          >
            <div className="text-center">
              <div className="text-xs font-medium opacity-70">{d.dayName}</div>
              <div className="text-sm font-semibold">{d.isToday ? 'Today' : d.date.split('-')[2]}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Time Slots */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filteredSlots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => slot.available && onSelectSlot(slot)}
            disabled={!slot.available}
            className={`relative p-3 rounded-lg border-2 transition-all text-left ${
              !slot.available
                ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                : selectedSlot?.id === slot.id
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : slot.isExpress
                    ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:border-orange-400'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-600'
            }`}
          >
            {slot.isExpress && (
              <div className="absolute -top-2 -right-2">
                <span className="flex items-center space-x-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Zap className="h-3 w-3" />
                  <span>EXPRESS</span>
                </span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">{slot.timeSlot}</span>
            </div>

            {slot.isExpress && slot.available && (
              <div className="mt-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                +₹{slot.price} delivery fee
              </div>
            )}

            {!slot.available && (
              <div className="mt-1 text-xs">Slot Full</div>
            )}
          </button>
        ))}
      </div>

      {/* Selected Slot Summary */}
      {selectedSlot && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {selectedSlot.isExpress ? '⚡ Express Delivery' : '📦 Scheduled Delivery'}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {selectedSlot.displayDate} • {selectedSlot.timeSlot}
              </p>
            </div>
            {selectedSlot.isExpress && (
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                +₹{selectedSlot.price}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
