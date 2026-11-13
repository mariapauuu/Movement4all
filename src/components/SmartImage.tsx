import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function SmartImage({
  src,
  alt,
  className = '',
  fallbackLabel,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#E6E4DF] text-[#151515]/70 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-6 h-6 mb-1.5 opacity-60" aria-hidden="true" />
        {fallbackLabel && (
          <span className="text-xs font-medium leading-snug max-w-[180px]">{fallbackLabel}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
