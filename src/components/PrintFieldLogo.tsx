import React from 'react';

interface PrintFieldLogoProps {
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  layout?: 'horizontal' | 'vertical' | 'icon-only';
  textColor?: string;
}

export default function PrintFieldLogo({
  className = '',
  iconSize = 'md',
  layout = 'horizontal',
  textColor = 'text-[#2D1F66]'
}: PrintFieldLogoProps) {
  // Size mappings for the logo image relative to layout
  const sizeClasses = {
    sm: 'max-h-8',
    md: 'max-h-12',
    lg: 'max-h-20',
    xl: 'max-h-28'
  };

  const selectedSizeClass = sizeClasses[iconSize];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        // We look for 'logo.png' in the public folder
        src="/logo.png"
        alt="Print Field Logo"
        className={`${selectedSizeClass} w-auto object-contain flex-shrink-0`}
        onError={(e) => {
          // If the image isn't uploaded yet, hide the img and show the fallback
          (e.currentTarget as HTMLImageElement).style.display = 'none';
          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      {/* Fallback block shown when /logo.png is missing */}
      <div className="hidden flex-col items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 w-full max-w-[200px] text-center">
        <span className="text-xs text-gray-500 mb-1">Missing Logo</span>
        <span className="text-[10px] text-gray-400">Upload your image to the <code className="bg-gray-200 px-1 rounded">public</code> folder as <code className="bg-gray-200 px-1 rounded">logo.png</code></span>
      </div>
    </div>
  );
}
