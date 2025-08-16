export const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  large: '1440px'
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px'
};

export const colors = {
  primary: '#007bff',
  success: '#28a745',
  danger: '#dc3545',
  warning: '#ffc107',
  secondary: '#6c757d',
  light: '#f8f9fa',
  dark: '#343a40',
  border: '#dee2e6',
  background: '#ffffff',
  text: '#212529',
  textMuted: '#6c757d'
};

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.1)',
  md: '0 2px 8px rgba(0,0,0,0.1)',
  lg: '0 4px 16px rgba(0,0,0,0.1)'
};

export const mediaQueries = {
  mobile: `@media (max-width: 767px)`,
  tablet: `@media (min-width: 768px) and (max-width: 1023px)`,
  desktop: `@media (min-width: 1024px)`
};

export const getResponsiveValue = (mobile: string, tablet?: string, desktop?: string) => ({
  base: mobile,
  tablet: tablet || mobile,
  desktop: desktop || tablet || mobile
});

export const containerStyles = {
  maxWidth: '100%',
  margin: '0 auto',
  padding: `0 ${spacing.md}`,
  [`@media (min-width: ${breakpoints.tablet})`]: {
    padding: `0 ${spacing.lg}`
  },
  [`@media (min-width: ${breakpoints.desktop})`]: {
    maxWidth: '1200px',
    padding: `0 ${spacing.xl}`
  }
};