import { memo, useState, useCallback } from 'react';
import { Copy, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helperText?: string;
  type?: string;
  error?: string;
  readOnly?: boolean;
}

function ConfigFieldComponent({ label, value, onChange, placeholder, helperText, type = 'text', error, readOnly }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={cn(
            'input pr-20',
            error && 'border-error-500',
            readOnly && 'bg-neutral-50 dark:bg-neutral-800/50'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !readOnly && (
            <button
              onClick={handleClear}
              title="Clear"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {value && (
            <button
              onClick={handleCopy}
              title="Copy"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="text-xs text-error-500 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}

export const ConfigField = memo(ConfigFieldComponent);
