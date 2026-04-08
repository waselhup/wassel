import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes intelligently, preventing conflicts
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format price in Saudi Riyal (SAR) format
 * @param amount - Amount in SAR
 * @returns Formatted string like "99 ر.س"
 */
export function formatPrice(amount: number): string {
  return `${Math.round(amount)} ر.س`;
}

/**
 * Format date based on locale
 * @param dateString - ISO date string
 * @param locale - 'ar' or 'en'
 * @returns Formatted date string
 */
export function formatDate(dateString: string, locale: string = 'ar'): string {
  const date = new Date(dateString);
  
  if (locale === 'ar') {
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get initials from a name
 * @param name - Full name
 * @returns First letters (up to 2)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}