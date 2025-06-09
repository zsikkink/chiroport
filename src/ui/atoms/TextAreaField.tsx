/**
 * TextAreaField Atom Component
 * 
 * A multi-line text input field with label and error handling
 */

export interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  required?: boolean;
}

export function TextAreaField({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  error,
  required = false
}: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-white text-base font-bold mb-2">
        {label} {required && '*'}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-white text-black rounded-lg p-4 border-2 border-white focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500 resize-vertical"
      />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );
} 