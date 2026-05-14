import { Delete } from 'lucide-react';
import { cn } from '../lib/utils';

interface KeypadProps {
  onKeyPress: (key: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  className?: string;
}

export function Keypad({ onKeyPress, onClear, onBackspace, className }: KeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'backspace'];

  return (
    <div className={cn("grid grid-cols-3 gap-3 p-4", className)}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            if (key === 'C') onClear();
            else if (key === 'backspace') onBackspace();
            else onKeyPress(key);
          }}
          className={cn(
            "h-16 text-2xl font-bold flex items-center justify-center rounded-xl transition-all active:scale-95",
            key === 'C' ? "bg-red-50 text-red-600 border border-red-100" :
            key === 'backspace' ? "bg-orange-50 text-orange-600 border border-orange-100" :
            "bg-white text-slate-800 border border-slate-200 shadow-sm"
          )}
        >
          {key === 'backspace' ? <Delete className="size-6" /> : key}
        </button>
      ))}
    </div>
  );
}
