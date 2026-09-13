import React from 'react';
import { useStore } from '../store';

type BrandLogoProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>;

export default function BrandLogo({ className = 'h-8 w-8 object-contain', alt = "Logo Van's Management", ...props }: BrandLogoProps) {
  const { lightLogo, darkLogo } = useStore();
  return <>
    <img src={lightLogo} alt={alt} className={`block dark:hidden ${className}`} {...props} />
    <img src={darkLogo} alt={alt} className={`hidden dark:block ${className}`} {...props} />
  </>;
}
