'use client';

import React from 'react';

// This component has been deprecated as session management is now handled by Supabase
// Keeping the component for backward compatibility but it now does nothing
export function SessionDebug({ show = false }: { show?: boolean }) {
  // Component disabled - Supabase handles all session management
  return null;
}

export default SessionDebug;
