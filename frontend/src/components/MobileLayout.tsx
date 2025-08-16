import React, { ReactNode } from 'react';
import { colors, spacing, shadows } from '../styles/responsive';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ 
  children, 
  title, 
  showBackButton, 
  onBack, 
  rightAction 
}) => {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.light,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 모바일 헤더 */}
      {title && (
        <header style={{
          backgroundColor: colors.background,
          borderBottom: `1px solid ${colors.border}`,
          padding: spacing.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: shadows.sm,
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            {showBackButton && (
              <button
                onClick={onBack}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: spacing.xs,
                  color: colors.primary
                }}
              >
                ←
              </button>
            )}
            <h1 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px'
            }}>
              {title}
            </h1>
          </div>
          {rightAction && (
            <div>{rightAction}</div>
          )}
        </header>
      )}

      {/* 메인 콘텐츠 */}
      <main style={{
        flex: 1,
        padding: spacing.md,
        overflow: 'auto'
      }}>
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;