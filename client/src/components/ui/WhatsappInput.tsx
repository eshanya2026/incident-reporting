/**
 * Indian WhatsApp number: "+91" is fixed and the user types only the 10-digit mobile number.
 * The value is the 10 digits; the server stores it with the 91 prefix.
 */

/** A stored number ("919840112345", "+91 98401 12345") as the 10 digits shown in the input. */
export const toLocalMobile = (stored?: string | null): string => {
  const digits = (stored ?? '').replace(/\D/g, '');
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(2, 12) : digits.slice(-10);
};

/** Empty, or a 10-digit Indian mobile number (starts with 6–9). */
export const isValidMobile = (local: string): boolean => !local || /^[6-9]\d{9}$/.test(local);

export function WhatsappInput({
  value,
  onChange,
  id,
  size = 'md',
  className = '',
}: {
  value: string;
  onChange: (tenDigits: string) => void;
  id?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const invalid = value.length > 0 && !isValidMobile(value);
  const pad = size === 'sm' ? 'py-1.5 text-xs' : 'py-3 text-sm';
  return (
    <div
      className={`flex items-stretch w-full rounded-lg border bg-white overflow-hidden transition focus-within:ring-2 focus-within:ring-[#5C1A22]/20 ${
        invalid ? 'border-red-400' : 'border-clinicalBorder focus-within:border-[#5C1A22]'
      } ${className}`}
    >
      <span className={`px-3 ${pad} bg-slate-100 text-slate-600 font-semibold border-r border-clinicalBorder select-none`}>+91</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="98765 43210"
        maxLength={10}
        aria-invalid={invalid}
        className={`flex-1 min-w-0 px-3 ${pad} bg-transparent outline-none text-[#172033] placeholder-[#94A3B8] tracking-wide`}
      />
    </div>
  );
}
