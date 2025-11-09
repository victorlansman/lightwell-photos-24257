import { createContext, useContext, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { azureApi } from '@/lib/azureApiClient';

/**
 * Context that syncs Supabase auth tokens with Azure API client.
 * This bridges Supabase Auth (magic links) with Azure backend (JWT validation).
 */

interface ApiAuthContextType {
  isConfigured: boolean;
}

const ApiAuthContext = createContext<ApiAuthContextType>({ isConfigured: false });

export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        console.log('[ApiAuth] Setting Azure API token from initial session');
        azureApi.setToken(session.access_token);
      }
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
    <ApiAuthContext.Provider value={{ isConfigured: true }}>
      {children}
    </ApiAuthContext.Provider>
  );
}

export const useApiAuth = () => useContext(ApiAuthContext);
