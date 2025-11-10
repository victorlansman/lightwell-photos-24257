import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Context that syncs Supabase auth tokens with Azure API client.
 * This bridges Supabase Auth (magic links) with Azure backend (JWT validation).
 */

interface ApiAuthContextType {
  isConfigured: boolean;
  isReady: boolean; // Track when token is set
}

const ApiAuthContext = createContext<ApiAuthContextType>({ isConfigured: false, isReady: false });

export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        console.log('[ApiAuth] Setting Azure API token from initial session');
        azureApi.setToken(session.access_token);
      }
      setIsReady(true); // Mark as ready even if no session (user logged out)
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
          console.log('[ApiAuth] Updating Azure API token from auth change');
          azureApi.setToken(session.access_token);
        } else {
          console.log('[ApiAuth] Clearing Azure API token (logged out)');
          azureApi.clearToken();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ApiAuthContext.Provider value={{ isConfigured: true, isReady }}>
      {children}
    </ApiAuthContext.Provider>
  );
}

export const useApiAuth = () => useContext(ApiAuthContext);
