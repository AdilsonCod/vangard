import React from 'react';

interface VansLogoProps {
  className?: string;
  color?: string; // Hex or tailwind text color
  fillOpacity?: number;
}

export default function VansLogo({ className = "w-10 h-10", color = "currentColor", fillOpacity = 0.2 }: VansLogoProps) {
  return (
    <svg 
      viewBox="0 0 400 400" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 
        This vector path represents an elegant generic barbershop logo: 
        - Stylized Scissors & Comb emblem
      */}
      <g stroke={color} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round">
        {/* Left Finger loop and blade */}
        <circle cx="150" cy="150" r="30" strokeWidth="20" />
        <path d="M 171 171 L 270 270" strokeWidth="20" />

        {/* Right Finger loop and blade */}
        <circle cx="250" cy="150" r="30" strokeWidth="20" />
        <path d="M 229 171 L 130 270" strokeWidth="20" />
        
        {/* Center pivot/screw */}
        <circle cx="200" cy="200" r="10" fill={color} stroke="none" />
        
        {/* Barbier Pole stylized diagonal ribbon under */}
        <path d="M 140 310 Q 200 290 260 310" strokeWidth="16" />
        <path d="M 145 335 Q 200 315 255 335" strokeWidth="10" />
      </g>
    </svg>
  );
}
